"""Collect Copilot Changelog posts into a Markdown archive on mirror-data."""

from __future__ import annotations

import argparse
import json
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
from markdownify import MarkdownConverter

FEED_URL = "https://github.blog/changelog/label/copilot/feed/"
USER_AGENT = "copilot-changelog-mirror/0.1"


@dataclass(frozen=True)
class FeedPost:
    title: str
    url: str
    published_at: str | None


@dataclass(frozen=True)
class NormalizedArticle:
    title: str
    markdown: str


class _ArchiveMarkdownConverter(MarkdownConverter):
    def convert_hN(self, level, node, text, parent_tags):
        heading = super().convert_hN(level, node, text, parent_tags)
        archive_id = node.get("id")
        if not archive_id:
            return heading
        return f"{heading.rstrip()}\n{{: #{archive_id} }}\n\n"


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


def _text(element) -> str:
    return " ".join(element.get_text(" ", strip=True).split())


def _element_marker(element) -> str:
    class_names = element.get("class", [])
    if isinstance(class_names, str):
        class_names = [class_names]
    return " ".join(
        [str(element.get("id", "")), *(str(value) for value in class_names)]
    ).casefold().replace("_", "-")


def _is_table_of_contents(element) -> bool:
    marker = _element_marker(element)
    return "table-of-contents" in marker or bool(
        re.search(r"(?:^|[^a-z0-9])toc(?:[^a-z0-9]|$)", marker)
    )


def _is_table_of_contents_menu(element) -> bool:
    marker = _element_marker(element)
    return "table-of-contents-menu" in marker or _text(element).casefold().startswith(
        "menu. currently selected:"
    )


def _table_of_contents_roots(root) -> list:
    elements = root.find_all(True)
    order = {id(element): index for index, element in enumerate(elements)}
    candidates = {id(element): element for element in elements if _is_table_of_contents(element)}
    for heading in root.find_all(["h2", "h3"]):
        if _text(heading).casefold() not in {"table of contents", "contents"}:
            continue
        container = heading.find_parent(["div", "nav", "section"])
        if (
            container is not None
            and container is not root
            and container.find("a", href=re.compile(r"^#")) is not None
        ):
            candidates[id(container)] = container

    roots = []
    for element in candidates.values():
        ancestor = element.parent
        while ancestor is not None and ancestor is not root:
            if id(ancestor) in candidates:
                break
            ancestor = ancestor.parent
        else:
            roots.append(element)
    return sorted(roots, key=lambda element: order[id(element)])


def _is_hidden_source_element(element) -> bool:
    style = str(element.get("style", ""))
    hidden_class = any(
        value in {"hidden", "is-hidden", "d-none"} for value in element.get("class", [])
    )
    return (
        element.has_attr("hidden")
        or element.get("aria-hidden") == "true"
        or hidden_class
        or bool(re.search(r"(?:^|;)\s*display\s*:\s*none(?:\s*;|$)", style, re.IGNORECASE))
    )


def _is_source_chrome(element, retained_toc_ids: set[int]) -> bool:
    if id(element) in retained_toc_ids:
        return False
    if element.name in {"script", "style", "noscript", "footer", "form", "button", "input"}:
        return True
    if element.name == "nav" and id(element) not in retained_toc_ids:
        return True
    if _is_hidden_source_element(element):
        return True
    if str(element.get("role", "")).casefold() in {"navigation", "menu", "button"}:
        return True

    marker = _element_marker(element)
    return any(
        value in marker
        for value in (
            "site-navigation",
            "primary-navigation",
            "secondary-navigation",
            "post-terms",
            "tag-list",
            "tag-cloud",
            "taxonomy",
            "share",
            "social",
            "back-to-changelog",
            "related-post",
            "entry-meta",
            "post-meta",
            "post-date",
            "reading-time",
            "changelog-entry__footer",
        )
    ) or _is_table_of_contents_menu(element)


def _find_article_root(soup):
    article = soup.find("article")
    if article is not None:
        return article
    class_names = (
        "wp-block-changelog-entry__content",
        "changelog-entry__content",
        "entry-content",
        "wp-block-post-content",
    )
    for class_name in class_names:
        content = soup.find(class_=class_name)
        if content is not None:
            return content
    return soup.body or soup


def _normalize_heading_fragments(root, source_url: str | None) -> None:
    headings = root.find_all(["h2", "h3", "h4", "h5", "h6"])
    archive_ids = {
        id(heading): f"archive-heading-{index}" for index, heading in enumerate(headings, 1)
    }
    source_ids: dict[str, str] = {}
    for element in root.find_all(True):
        source_id = element.get("id")
        if not source_id:
            continue
        if element.name in {"h2", "h3", "h4", "h5", "h6"}:
            target = element
        else:
            target = element.find_parent(["h2", "h3", "h4", "h5", "h6"])
            target = target or element.find(["h2", "h3", "h4", "h5", "h6"])
            if target is None and element.name == "a" and not _text(element):
                target = element.find_next(["h2", "h3", "h4", "h5", "h6"])
        if target is not None and id(target) in archive_ids:
            source_ids.setdefault(str(source_id), archive_ids[id(target)])

    for heading in headings:
        heading["id"] = archive_ids[id(heading)]

    source_page = urlparse(source_url) if source_url is not None else None
    for link in root.find_all("a", href=True):
        href = str(link["href"])
        if href.startswith("#"):
            source_id = unquote(href[1:])
        elif source_url is not None and source_page is not None:
            target_page = urlparse(urljoin(source_url, href))
            same_source_page = (
                target_page.scheme,
                target_page.netloc,
                target_page.path.rstrip("/"),
            ) == (
                source_page.scheme,
                source_page.netloc,
                source_page.path.rstrip("/"),
            )
            if not same_source_page or not target_page.fragment:
                continue
            source_id = unquote(target_page.fragment)
        else:
            continue
        archive_id = source_ids.get(source_id)
        if archive_id:
            link["href"] = f"#{archive_id}"
        else:
            del link["href"]


def normalize_article(
    content: bytes, discovery_title: str, source_url: str | None = None
) -> NormalizedArticle:
    soup = BeautifulSoup(content, "html.parser")
    source_article = soup.find("article")
    title_heading = source_article.find("h1") if source_article is not None else None
    title_heading = title_heading or soup.find("h1")
    title = _text(title_heading) if title_heading is not None else ""
    title = title or discovery_title.strip() or "Untitled article"

    article = _find_article_root(soup)
    toc_roots = _table_of_contents_roots(article)
    visible_toc_roots = [
        element
        for element in toc_roots
        if not _is_hidden_source_element(element) and not _is_table_of_contents_menu(element)
    ]
    retained_toc_ids = {id(visible_toc_roots[0])} if visible_toc_roots else set()
    for element in toc_roots:
        if id(element) not in retained_toc_ids and element.parent is not None:
            element.decompose()

    for element in list(article.find_all(True)):
        if element.parent is not None and _is_source_chrome(element, retained_toc_ids):
            element.decompose()
    for element in list(article.find_all(["a", "span"])):
        if element.parent is None:
            continue
        label = _text(element).casefold()
        if label in {"copied", "shared", "back to changelog"}:
            element.decompose()
    for heading in list(article.find_all("h1")):
        heading.decompose()

    _normalize_heading_fragments(article, source_url)
    converter = _ArchiveMarkdownConverter(heading_style="ATX", bullets="-")
    markdown = converter.convert(str(article))
    return NormalizedArticle(title, markdown.strip() + "\n")


def article_to_markdown(content: bytes) -> str:
    return normalize_article(content, "").markdown


def _slug(url: str) -> str:
    segment = unquote(urlparse(url).path.rstrip("/").split("/")[-1]) or "article"
    segment = re.sub(r"\.[a-zA-Z0-9]{1,8}$", "", segment)
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", segment).strip("-_").lower()
    return slug or "article"


def _archive_document(post: FeedPost, article: NormalizedArticle, fetched_at: str) -> str:
    fields = [
        f"title: {json.dumps(article.title, ensure_ascii=False)}",
        f"source_url: {post.url}",
    ]
    if post.published_at:
        fields.append(f"published_at: {post.published_at}")
    fields.append(f"fetched_at: {fetched_at}")
    return "---\n" + "\n".join(fields) + "\n---\n\n" + article.markdown


def archive_document_from_html(post: FeedPost, source_html: bytes, fetched_at: str) -> str:
    article = normalize_article(source_html, post.title, post.url)
    return _archive_document(post, article, fetched_at)


def collect(feed_url: str, repo: Path, branch: str) -> bool:
    posts = parse_feed(fetch_url(feed_url), feed_url)
    archive: dict[str, str] = {}
    for post in posts:
        filename = f"{_slug(post.url)}.md"
        prior = _read_archive_file(repo, branch, filename)
        source_html = fetch_url(post.url)
        article = normalize_article(source_html, post.title, post.url)
        fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        candidate = _archive_document(post, article, fetched_at)
        if prior is not None:
            previous_without_fetch = re.sub(r"(?m)^fetched_at: .+\n", "", prior)
            candidate_without_fetch = re.sub(r"(?m)^fetched_at: .+\n", "", candidate)
            if previous_without_fetch == candidate_without_fetch:
                fetched_at = _existing_fetch_time_from_text(prior) or fetched_at
                candidate = _archive_document(post, article, fetched_at)
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
