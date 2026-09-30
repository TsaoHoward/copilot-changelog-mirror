"""Collect Copilot Changelog posts into a Markdown archive on mirror-data."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from urllib.parse import unquote, urljoin, urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET


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


class ArticleMarkdown(HTMLParser):
    """Convert the article portion of a page to readable Markdown."""

    BLOCKS = {"p", "div", "section", "article", "header", "footer", "ul", "ol", "li", "blockquote", "pre", "table", "tr"}
    SKIP = {"script", "style", "noscript", "svg", "iframe", "nav"}
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
    TARGET_CLASSES = {"entry-content", "wp-block-post-content", "changelog-entry__content", "wp-block-changelog-entry__content"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lines: list[str] = []
        self.inline: list[str] = []
        self.skip_depth = 0
        self.target_depth: int | None = None
        self.depth = 0
        self.list_stack: list[tuple[str, int]] = []
        self.pre_depth = 0
        self.target_tag: str | None = None
        self.finished_target = False

    def _flush(self):
        value = "".join(self.inline).strip()
        if value:
            self.lines.append(value)
        self.inline.clear()

    def _break(self):
        self._flush()
        if self.lines and self.lines[-1] != "":
            self.lines.append("")

    def handle_starttag(self, tag, attrs):
        if self.finished_target:
            return
        attrs = dict(attrs)
        if tag in self.SKIP:
            self.skip_depth += 1
            return
        if self.skip_depth:
            return
        if tag not in self.VOID:
            self.depth += 1
        classes = set((attrs.get("class") or "").split())
        if self.target_depth is None and (tag == "article" or classes & self.TARGET_CLASSES):
            self.target_depth = self.depth
            self.target_tag = tag
            self.lines.clear()
            self.inline.clear()
        if self.target_depth is not None and self.depth < self.target_depth:
            return
        if tag in self.BLOCKS:
            self._break()
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.inline.append("\n" + "#" * int(tag[1]) + " ")
        elif tag in ("strong", "b"):
            self.inline.append("**")
        elif tag in ("em", "i"):
            self.inline.append("*")
        elif tag == "pre":
            self.pre_depth += 1
            self._break()
            self.inline.append("```\n")
        elif tag == "code" and not self.pre_depth:
            self.inline.append("`")
        elif tag == "a" and attrs.get("href"):
            self.inline.append("[")
            self._link = attrs["href"]
        elif tag in ("ul", "ol"):
            self.list_stack.append((tag, 1))
        elif tag == "li":
            self._flush()
            indent = "  " * max(0, len(self.list_stack) - 1)
            kind, number = self.list_stack[-1] if self.list_stack else ("ul", 1)
            marker = f"{number}. " if kind == "ol" else "- "
            self.inline.append("\n" + indent + marker)
            if kind == "ol":
                self.list_stack[-1] = (kind, number + 1)
        elif tag == "br":
            self.inline.append("  \n")
        elif tag == "img" and attrs.get("alt"):
            self.inline.append(f"![{attrs['alt']}]({attrs.get('src', '')})")

    def handle_endtag(self, tag):
        if self.finished_target or tag in self.VOID:
            return
        if tag in self.SKIP:
            self.skip_depth = max(0, self.skip_depth - 1)
            return
        if self.skip_depth:
            return
        if self.target_depth is not None and self.depth < self.target_depth:
            return
        if tag == "a" and hasattr(self, "_link"):
            self.inline.append(f"]({self._link})")
            del self._link
        elif tag in ("strong", "b"):
            self.inline.append("**")
        elif tag in ("em", "i"):
            self.inline.append("*")
        elif tag == "pre":
            self.inline.append("\n```")
            self.pre_depth = max(0, self.pre_depth - 1)
        elif tag == "code" and not self.pre_depth:
            self.inline.append("`")
        if tag == "li":
            self._flush()
        if tag in ("ul", "ol") and self.list_stack:
            self.list_stack.pop()
        if tag in self.BLOCKS:
            self._break()
        if self.target_depth == self.depth and tag == self.target_tag:
            self.target_depth = None
            self.target_tag = None
            self.finished_target = True
        self.depth = max(0, self.depth - 1)

    def handle_data(self, data):
        if self.finished_target or self.skip_depth or (self.target_depth is not None and self.depth < self.target_depth):
            return
        cleaned = re.sub(r"\s+", " ", data)
        if cleaned.strip():
            if self.inline and not self.inline[-1].endswith((" ", "\n", "[", "`", "**", "*")) and not cleaned.startswith(" "):
                self.inline.append(" ")
            self.inline.append(cleaned)

    def markdown(self) -> str:
        self._flush()
        return "\n".join(line for line in self.lines).strip() + "\n"


def article_to_markdown(content: bytes) -> str:
    parser = ArticleMarkdown()
    parser.feed(content.decode("utf-8", errors="replace"))
    return parser.markdown()


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
    result = subprocess.run(["git", "-C", str(repo), "show", f"{branch}:posts/{filename}"], capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else None


def _existing_fetch_time_from_text(content: str) -> str | None:
    match = re.search(r"^fetched_at: (.+)$", content, re.MULTILINE)
    return match.group(1) if match else None


def write_archive_branch(repo: Path, branch: str, archive: dict[str, str]) -> bool:
    repo = repo.resolve()
    exists = subprocess.run(["git", "-C", str(repo), "show-ref", "--verify", "--quiet", f"refs/heads/{branch}"]).returncode == 0
    head = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
    worktree = Path(tempfile.mkdtemp(prefix="copilot-mirror-"))
    shutil.rmtree(worktree)
    try:
        if exists:
            subprocess.run(["git", "-C", str(repo), "worktree", "add", str(worktree), branch], check=True, capture_output=True)
        else:
            subprocess.run(["git", "-C", str(repo), "worktree", "add", "--detach", str(worktree), head], check=True, capture_output=True)
            subprocess.run(["git", "-C", str(worktree), "switch", "--orphan", branch], check=True, capture_output=True)
            subprocess.run(["git", "-C", str(worktree), "rm", "-rf", "--ignore-unmatch", "."], check=True, capture_output=True)
            for child in worktree.iterdir():
                if child.name == ".git":
                    continue
                shutil.rmtree(child) if child.is_dir() else child.unlink()
        posts_dir = worktree / "posts"
        posts_dir.mkdir(exist_ok=True)
        for filename, content in archive.items():
            (posts_dir / filename).write_text(content, encoding="utf-8")
        subprocess.run(["git", "-C", str(worktree), "add", "--all"], check=True)
        changed = subprocess.run(["git", "-C", str(worktree), "diff", "--cached", "--quiet"]).returncode != 0
        if not changed:
            return False
        subprocess.run(["git", "-C", str(worktree), "commit", "-m", "Mirror Copilot Changelog posts"], check=True)
        return True
    finally:
        subprocess.run(["git", "-C", str(repo), "worktree", "remove", "--force", str(worktree)], capture_output=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Mirror Copilot Changelog articles to the mirror-data Git branch.")
    parser.add_argument("--feed-url", default=FEED_URL, help="RSS feed URL (defaults to the official Copilot feed).")
    parser.add_argument("--repo", type=Path, default=Path.cwd(), help="Git repository receiving the mirror-data branch.")
    parser.add_argument("--data-branch", default="mirror-data", help="Branch for collected Markdown articles.")
    args = parser.parse_args(argv)
    current_branch = subprocess.run(
        ["git", "-C", str(args.repo), "branch", "--show-current"],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    if args.data_branch in {"main", "master"} or args.data_branch == current_branch:
        parser.error("the archive branch must be separate from the application branch")
    changed = collect(args.feed_url, args.repo, args.data_branch)
    print("Archive updated." if changed else "Archive is already up to date.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
