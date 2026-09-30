"""Collect Copilot Changelog posts into a Markdown archive on mirror-data."""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup
from markdownify import markdownify

FEED_URL = "https://github.blog/changelog/label/copilot/feed/"
USER_AGENT = "copilot-changelog-mirror/0.1"


@dataclass(frozen=True)
class FeedPost:
    title: str
    url: str
    published_at: str | None


def fetch_url(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read()


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _child_text(element: ET.Element, name: str) -> str | None:
    for child in element:
        if _local_name(child.tag) == name:
            if name == "link" and child.attrib.get("href"):
                return child.attrib["href"]
            return (child.text or "").strip() or None
    return None


def _normalize_date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        result = parsedate_to_datetime(value)
    except (TypeError, ValueError, OverflowError):
        try:
            result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if result.tzinfo is None:
        result = result.replace(tzinfo=timezone.utc)
    return result.astimezone(timezone.utc).isoformat(timespec="seconds")


def parse_feed(xml_content: bytes, feed_url: str) -> list[FeedPost]:
    root = ET.fromstring(xml_content)
    posts: list[FeedPost] = []
    for element in root.iter():
        if _local_name(element.tag) not in ("item", "entry"):
            continue
        link = _child_text(element, "link")
        if not link:
            continue
        title = _child_text(element, "title") or link
        published = _child_text(element, "pubdate") or _child_text(element, "published")
        posts.append(FeedPost(title, _absolute_url(feed_url, link), _normalize_date(published)))
    return posts


def _absolute_url(base: str, value: str) -> str:
    return urljoin(base, value)


def article_to_markdown(content: bytes) -> str:
    soup = BeautifulSoup(content, "html.parser")
    article = soup.find("article")
    if article is None:
        for class_name in (
            "entry-content",
            "wp-block-post-content",
            "changelog-entry__content",
            "wp-block-changelog-entry__content",
        ):
            article = soup.find(class_=class_name)
            if article is not None:
                break
    if article is None:
        article = soup.body or soup
    markdown = markdownify(str(article), heading_style="ATX", bullets="-")
    return markdown.strip() + "\n"


def _slug(url: str) -> str:
    segment = unquote(urlparse(url).path.rstrip("/").split("/")[-1]) or "article"
    segment = re.sub(r"\.[a-zA-Z0-9]{1,8}$", "", segment)
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", segment).strip("-_").lower()
    return slug or "article"


def _archive_document(post: FeedPost, body: str, fetched_at: str) -> str:
    fields = [f"source_url: {post.url}"]
    if post.published_at:
        fields.append(f"published_at: {post.published_at}")
    fields.append(f"fetched_at: {fetched_at}")
    return "---\n" + "\n".join(fields) + "\n---\n\n" + body


def collect(feed_url: str, repo: Path, branch: str) -> bool:
    posts = parse_feed(fetch_url(feed_url), feed_url)
    archive: dict[str, str] = {}
    for post in posts:
        filename = f"{_slug(post.url)}.md"
        prior = _read_archive_file(repo, branch, filename)
        body = article_to_markdown(fetch_url(post.url))
        fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        candidate = _archive_document(post, body, fetched_at)
        if prior is not None:
            previous_without_fetch = re.sub(r"(?m)^fetched_at: .+\n", "", prior)
            candidate_without_fetch = re.sub(r"(?m)^fetched_at: .+\n", "", candidate)
            if previous_without_fetch == candidate_without_fetch:
                fetched_at = _existing_fetch_time_from_text(prior) or fetched_at
                candidate = _archive_document(post, body, fetched_at)
        archive[filename] = candidate
    return write_archive_branch(repo, branch, archive)


def _read_archive_file(repo: Path, branch: str, filename: str) -> str | None:
    branch_ref = _archive_branch_ref(repo, branch)
    if branch_ref is None:
        return None
    result = subprocess.run(
        ["git", "-C", str(repo), "show", f"{branch_ref}:posts/{filename}"],
        capture_output=True,
        text=True,
    )
    return result.stdout if result.returncode == 0 else None


def _archive_branch_ref(repo: Path, branch: str) -> str | None:
    for ref in (f"refs/heads/{branch}", f"refs/remotes/origin/{branch}"):
        result = subprocess.run(["git", "-C", str(repo), "show-ref", "--verify", "--quiet", ref])
        if result.returncode == 0:
            return branch if ref.startswith("refs/heads/") else f"origin/{branch}"
    return None


def _existing_fetch_time_from_text(content: str) -> str | None:
    match = re.search(r"^fetched_at: (.+)$", content, re.MULTILINE)
    return match.group(1) if match else None


def write_archive_branch(repo: Path, branch: str, archive: dict[str, str]) -> bool:
    repo = repo.resolve()
    branch_ref = _archive_branch_ref(repo, branch)
    worktree = Path(tempfile.mkdtemp(prefix="copilot-mirror-"))
    shutil.rmtree(worktree)
    try:
        if branch_ref == branch:
            subprocess.run(
                ["git", "-C", str(repo), "worktree", "add", str(worktree), branch],
                check=True,
                capture_output=True,
            )
        elif branch_ref is not None:
            subprocess.run(
                [
                    "git",
                    "-C",
                    str(repo),
                    "worktree",
                    "add",
                    "--track",
                    "-b",
                    branch,
                    str(worktree),
                    branch_ref,
                ],
                check=True,
                capture_output=True,
            )
        else:
            head = subprocess.run(
                ["git", "-C", str(repo), "rev-parse", "HEAD"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
            subprocess.run(
                ["git", "-C", str(repo), "worktree", "add", "--detach", str(worktree), head],
                check=True,
                capture_output=True,
            )
            subprocess.run(
                ["git", "-C", str(worktree), "switch", "--orphan", branch],
                check=True,
                capture_output=True,
            )
            subprocess.run(
                ["git", "-C", str(worktree), "rm", "-rf", "--ignore-unmatch", "."],
                check=True,
                capture_output=True,
            )
            for child in worktree.iterdir():
                if child.name == ".git":
                    continue
                shutil.rmtree(child) if child.is_dir() else child.unlink()
        posts_dir = worktree / "posts"
        posts_dir.mkdir(exist_ok=True)
        for filename, content in archive.items():
            (posts_dir / filename).write_text(content, encoding="utf-8")
        subprocess.run(["git", "-C", str(worktree), "add", "--all"], check=True)
        changed = (
            subprocess.run(["git", "-C", str(worktree), "diff", "--cached", "--quiet"]).returncode
            != 0
        )
        if not changed:
            return False
        subprocess.run(
            ["git", "-C", str(worktree), "commit", "-m", "Mirror Copilot Changelog posts"],
            check=True,
        )
        return True
    finally:
        subprocess.run(
            ["git", "-C", str(repo), "worktree", "remove", "--force", str(worktree)],
            capture_output=True,
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Mirror Copilot Changelog articles to the mirror-data Git branch."
    )
    parser.add_argument(
        "--feed-url", default=FEED_URL, help="RSS feed URL (defaults to the official Copilot feed)."
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path.cwd(),
        help="Git repository receiving the mirror-data branch.",
    )
    parser.add_argument(
        "--data-branch", default="mirror-data", help="Branch for collected Markdown articles."
    )
    args = parser.parse_args(argv)
    current_branch = subprocess.run(
        ["git", "-C", str(args.repo), "branch", "--show-current"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if args.data_branch in {"main", "master"} or args.data_branch == current_branch:
        parser.error("the archive branch must be separate from the application branch")
    changed = collect(args.feed_url, args.repo, args.data_branch)
    print("Archive updated." if changed else "Archive is already up to date.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
