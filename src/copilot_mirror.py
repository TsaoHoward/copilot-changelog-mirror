"""Capture source snapshots and render them into a Markdown archive on mirror-data."""

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


@dataclass(frozen=True)
class NormalizedArticle:
    title: str
    markdown: str


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
    return (
        " ".join([str(element.get("id", "")), *(str(value) for value in class_names)])
        .casefold()
        .replace("_", "-")
    )


def _is_table_of_contents(element) -> bool:
    # The source of the generated sidebar TOC is the editorial body itself.
    if "js-table-of-contents-source" in element.get("class", []):
        return False
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
    if element.name in {"h2", "h3", "h4", "h5", "h6"}:
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
    # Captured Changelog pages separate the editorial body from header metadata,
    # responsive sidebar TOCs, and footer controls. The lead image is a sibling.
    content = soup.select_one(".PostContent-main.editorial-content-block")
    if content is not None:
        root = soup.new_tag("div")
        article = content.find_parent("article")
        if article is not None:
            for image in article.select(".ChangelogFeaturedImage"):
                root.append(image.extract())
        root.append(content.extract())
        return root
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
    from bs4 import BeautifulSoup
    from markdownify import MarkdownConverter

    class _ArchiveMarkdownConverter(MarkdownConverter):
        def convert_video(self, node, text, parent_tags):
            # Markdown has no video syntax; retain the source media as HTML.
            return f"\n\n{node}\n\n"

        def convert_hN(self, level, node, text, parent_tags):
            heading = super().convert_hN(level, node, text, parent_tags)
            archive_id = node.get("id")
            if not archive_id:
                return heading
            return f"{heading.rstrip()}\n{{: #{archive_id} }}\n\n"

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


def _fetch_feed_articles(feed_url: str) -> Iterator[tuple[FeedPost, bytes]]:
    for post in parse_feed(fetch_url(feed_url), feed_url):
        yield post, fetch_url(post.url)


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
            "discovery_title": post.title,
            "published_at": post.published_at,
        }
        files[html_path] = source_html
        files[metadata_path] = (json.dumps(provenance, ensure_ascii=False, indent=2) + "\n").encode(
            "utf-8"
        )
    return write_data_branch(repo, branch, files, "Capture Copilot Changelog snapshots")


def _structured_publication_time(source_html: bytes, source_url: str) -> str | None:
    from bs4 import BeautifulSoup

    def records(value):
        if isinstance(value, list):
            for item in value:
                yield from records(item)
        elif isinstance(value, dict):
            yield value
            for item in value.values():
                if isinstance(item, (dict, list)):
                    yield from records(item)

    def matches_source(value):
        if isinstance(value, dict):
            return any(matches_source(value.get(key)) for key in ("@id", "url"))
        return isinstance(value, str) and value.rstrip("/") == source_url.rstrip("/")

    dates = set()
    soup = BeautifulSoup(source_html, "html.parser")
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            metadata = json.loads(script.get_text())
        except ValueError:
            continue
        for record in records(metadata):
            kinds = record.get("@type", [])
            kinds = [kinds] if isinstance(kinds, str) else kinds
            if not isinstance(kinds, list) or not any(
                kind in {"Article", "TechArticle", "BlogPosting", "WebPage"}
                for kind in kinds
                if isinstance(kind, str)
            ):
                continue
            if not any(
                matches_source(record.get(key)) for key in ("url", "@id", "mainEntityOfPage")
            ):
                continue
            value = record.get("datePublished")
            date = _normalize_date(value) if isinstance(value, str) else None
            if date is not None:
                dates.add(date)
    if len(dates) > 1:
        raise ValueError(
            f"conflicting article-associated datePublished timestamps: {sorted(dates)}"
        )
    return next(iter(dates), None)


def _persisted_timestamp(value: object, field: str) -> str:
    try:
        if not isinstance(value, str) or any(ord(char) < 32 or ord(char) == 127 for char in value):
            raise ValueError
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if timestamp.tzinfo is None:
            raise ValueError
        return timestamp.astimezone(timezone.utc).isoformat(timespec="seconds")
    except (ValueError, OverflowError):
        raise ValueError(f"{field} must be an ISO timestamp with a timezone") from None


def _provenance_post(metadata: object, source_html: bytes) -> tuple[FeedPost, str]:
    if not isinstance(metadata, dict):
        raise ValueError("provenance JSON must be an object")
    url = metadata.get("source_url")
    if not isinstance(url, str) or any(
        char.isspace() or ord(char) < 32 or ord(char) == 127 for char in url
    ):
        raise ValueError("source_url must be an absolute source URL")
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https", "file"} or not (
        parsed.netloc if parsed.scheme != "file" else parsed.path.startswith("/")
    ):
        raise ValueError("source_url must be an absolute source URL")
    fetched_at = metadata.get("fetched_at")
    _persisted_timestamp(fetched_at, "fetched_at")
    assert isinstance(fetched_at, str)
    title = metadata.get("discovery_title", url)
    if not isinstance(title, str):
        raise ValueError("discovery_title must be a string when present")
    published_at = metadata.get("published_at")
    published = None
    if published_at is not None:
        published = _persisted_timestamp(published_at, "published_at")
    if published is None:
        published = _structured_publication_time(source_html, url)
    return FeedPost(title.strip() or url, url, published), fetched_at


def _existing_source_url(content: bytes) -> str | None:
    text = content.decode("utf-8")
    if not text.startswith("---\n"):
        return None
    frontmatter = text.split("---\n", 2)[1]
    match = re.search(r"^source_url:\s*(.+)$", frontmatter, re.MULTILINE)
    if match is None:
        return None
    value = match.group(1).strip()
    if value.startswith('"'):
        return json.loads(value)
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1].replace("''", "'")
    return value


def render(repo: Path, branch: str) -> bool:
    branch_ref = _data_branch_ref(repo, branch)
    if branch_ref is None:
        raise ValueError("archive branch is missing; run capture first")
    revision = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", branch_ref],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    paths = subprocess.run(
        ["git", "-C", str(repo), "ls-tree", "-rz", revision],
        check=True,
        capture_output=True,
    ).stdout.split(b"\0")
    entries = {}
    for entry in paths:
        if entry:
            attributes, path = entry.split(b"\t", 1)
            entries[path.decode("utf-8")] = attributes.split()[0]
    html_paths = sorted(
        path for path in entries if path.startswith("snapshots/") and path.endswith(".html")
    )
    if not html_paths:
        raise ValueError("archive has no HTML snapshots; run capture first")
    archive: dict[str, str] = {}
    source_urls: dict[str, str] = {}
    for path in html_paths:
        try:
            metadata_path = str(Path(path).with_suffix(".json"))
            for input_path in (path, metadata_path):
                if input_path in entries and entries[input_path] not in {b"100644", b"100755"}:
                    raise ValueError(f"{input_path} must be a regular saved file")
            try:
                metadata = json.loads(_read_revision_file(repo, revision, metadata_path))
            except ValueError as error:
                raise ValueError(f"invalid provenance JSON in {metadata_path}: {error}") from error
            source_html = _read_revision_file(repo, revision, path)
            if not source_html.strip():
                raise ValueError("saved HTML is empty")
            post, fetched_at = _provenance_post(metadata, source_html)
            filename = f"{_slug(post.url)}.md"
            if filename in source_urls and source_urls[filename] != post.url:
                raise ValueError(
                    f"post identity collision at posts/{filename}: {source_urls[filename]} and {post.url}"
                )
            target = f"posts/{filename}"
            if target in entries:
                if entries[target] not in {b"100644", b"100755"}:
                    raise ValueError(f"{target} must be a regular archive post")
                existing_url = _existing_source_url(_read_revision_file(repo, revision, target))
                if existing_url is not None and existing_url != post.url:
                    raise ValueError(f"{target} has conflicting source_url: {existing_url}")
            source_urls[filename] = post.url
            archive[filename] = archive_document_from_html(post, source_html, fetched_at)
        except Exception as error:
            raise ValueError(f"{path}: {error}") from error
    return write_archive_branch(repo, branch, archive)


def _read_revision_file(repo: Path, revision: str, path: str) -> bytes:
    result = subprocess.run(
        ["git", "-C", str(repo), "show", f"{revision}:{path}"],
        capture_output=True,
    )
    if result.returncode:
        raise ValueError(f"cannot read {path} at {revision}")
    return result.stdout


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


def write_archive_branch(repo: Path, branch: str, archive: dict[str, str]) -> bool:
    files = {f"posts/{filename}": content.encode("utf-8") for filename, content in archive.items()}
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


def _archive_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path.cwd(),
        help="Git repository receiving the mirror-data branch.",
    )
    parser.add_argument("--data-branch", default="mirror-data", help="Archive branch.")


def _validate_data_branch(args: argparse.Namespace, parser: argparse.ArgumentParser) -> None:
    current_branch = subprocess.run(
        ["git", "-C", str(args.repo), "branch", "--show-current"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if args.data_branch in {"main", "master"} or args.data_branch == current_branch:
        parser.error("the archive branch must be separate from the application branch")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Capture source snapshots or render saved snapshots into archive posts."
    )
    commands = parser.add_subparsers(dest="command", required=True)
    capture_parser = commands.add_parser("capture", help="Acquire raw source snapshots.")
    _archive_options(capture_parser)
    capture_parser.add_argument("--feed-url", default=FEED_URL, help="RSS feed URL.")
    render_parser = commands.add_parser("render", help="Render persisted snapshots offline.")
    _archive_options(render_parser)
    args = parser.parse_args(argv)
    _validate_data_branch(args, parser)
    try:
        if args.command == "capture":
            changed = capture(args.feed_url, args.repo, args.data_branch)
            print("Snapshots updated." if changed else "Snapshots are already up to date.")
        else:
            changed = render(args.repo, args.data_branch)
            print("Archive updated." if changed else "Archive is already up to date.")
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f"{args.command} failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
