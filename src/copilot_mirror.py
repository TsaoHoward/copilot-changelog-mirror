"""Collect Copilot Changelog posts into a Markdown archive on mirror-data."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
from urllib.request import Request, urlopen

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
    from bs4 import BeautifulSoup
    from markdownify import markdownify

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


def _fetch_feed_articles(feed_url: str) -> Iterator[tuple[FeedPost, bytes]]:
    for post in parse_feed(fetch_url(feed_url), feed_url):
        yield post, fetch_url(post.url)


def collect(feed_url: str, repo: Path, branch: str) -> bool:
    archive: dict[str, str] = {}
    for post, source_html in _fetch_feed_articles(feed_url):
        filename = f"{_slug(post.url)}.md"
        prior = _read_archive_file(repo, branch, filename)
        body = article_to_markdown(source_html)
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


def _snapshot_identity(url: str) -> str:
    suffix = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
    return f"{_slug(url)}-{suffix}"


def capture(feed_url: str, repo: Path, branch: str) -> bool:
    files: dict[str, bytes] = {}
    for post, source_html in _fetch_feed_articles(feed_url):
        identity = _snapshot_identity(post.url)
        html_path = f"snapshots/{identity}.html"
        metadata_path = f"snapshots/{identity}.json"
        previous_html = _read_branch_file(repo, branch, html_path)
        previous_metadata = _read_branch_file(repo, branch, metadata_path)
        if source_html == previous_html and previous_metadata is not None:
            continue

        provenance = {
            "source_url": post.url,
            "fetched_at": datetime.now(timezone.utc).isoformat(timespec="microseconds"),
        }
        files[html_path] = source_html
        files[metadata_path] = (
            json.dumps(provenance, ensure_ascii=False, indent=2) + "\n"
        ).encode("utf-8")
    return write_data_branch(repo, branch, files, "Capture Copilot Changelog snapshots")


def _read_archive_file(repo: Path, branch: str, filename: str) -> str | None:
    content = _read_branch_file(repo, branch, f"posts/{filename}")
    return content.decode("utf-8") if content is not None else None


def _read_branch_file(repo: Path, branch: str, path: str) -> bytes | None:
    branch_ref = _data_branch_ref(repo, branch)
    if branch_ref is None:
        return None
    result = subprocess.run(
        ["git", "-C", str(repo), "show", f"{branch_ref}:{path}"],
        capture_output=True,
    )
    return result.stdout if result.returncode == 0 else None


def _data_branch_ref(repo: Path, branch: str) -> str | None:
    for ref in (f"refs/heads/{branch}", f"refs/remotes/origin/{branch}"):
        result = subprocess.run(["git", "-C", str(repo), "show-ref", "--verify", "--quiet", ref])
        if result.returncode == 0:
            return branch if ref.startswith("refs/heads/") else f"origin/{branch}"
    return None


def _existing_fetch_time_from_text(content: str) -> str | None:
    match = re.search(r"^fetched_at: (.+)$", content, re.MULTILINE)
    return match.group(1) if match else None


def write_archive_branch(repo: Path, branch: str, archive: dict[str, str]) -> bool:
    files = {
        f"posts/{filename}": content.encode("utf-8") for filename, content in archive.items()
    }
    return write_data_branch(repo, branch, files, "Mirror Copilot Changelog posts")


def write_data_branch(repo: Path, branch: str, files: dict[str, bytes], message: str) -> bool:
    if not files:
        return False
    repo = repo.resolve()
    branch_ref = _data_branch_ref(repo, branch)
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
        for filename, content in files.items():
            destination = worktree / filename
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)
        subprocess.run(["git", "-C", str(worktree), "add", "--", *files], check=True)
        changed = (
            subprocess.run(["git", "-C", str(worktree), "diff", "--cached", "--quiet"]).returncode
            != 0
        )
        if not changed:
            return False
        subprocess.run(
            ["git", "-C", str(worktree), "commit", "-m", message],
            check=True,
        )
        return True
    finally:
        subprocess.run(
            ["git", "-C", str(repo), "worktree", "remove", "--force", str(worktree)],
            capture_output=True,
        )


def _cli_parser(description: str, data_branch_help: str) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument(
        "--feed-url",
        default=FEED_URL,
        help="RSS feed URL (defaults to the official Copilot feed).",
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path.cwd(),
        help="Git repository receiving the mirror-data branch.",
    )
    parser.add_argument("--data-branch", default="mirror-data", help=data_branch_help)
    return parser


def _validate_data_branch(args: argparse.Namespace, parser: argparse.ArgumentParser) -> None:
    current_branch = subprocess.run(
        ["git", "-C", str(args.repo), "branch", "--show-current"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if args.data_branch in {"main", "master"} or args.data_branch == current_branch:
        parser.error("the archive branch must be separate from the application branch")


def capture_main(argv: list[str] | None = None) -> int:
    parser = _cli_parser(
        "Capture raw Copilot Changelog source HTML on the mirror-data Git branch.",
        "Branch for captured source snapshots.",
    )
    args = parser.parse_args(argv)
    _validate_data_branch(args, parser)
    changed = capture(args.feed_url, args.repo, args.data_branch)
    print("Snapshots updated." if changed else "Snapshots are already up to date.")
    return 0


def main(argv: list[str] | None = None) -> int:
    command_line = list(sys.argv[1:] if argv is None else argv)
    if command_line[:1] == ["capture"]:
        return capture_main(command_line[1:])
    parser = _cli_parser(
        "Mirror Copilot Changelog articles to the mirror-data Git branch.",
        "Branch for collected Markdown articles.",
    )
    args = parser.parse_args(argv)
    _validate_data_branch(args, parser)
    changed = collect(args.feed_url, args.repo, args.data_branch)
    print("Archive updated." if changed else "Archive is already up to date.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
