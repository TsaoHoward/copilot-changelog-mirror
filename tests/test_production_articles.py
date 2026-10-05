"""Acceptance at the saved HTML -> archive document -> published HTML seam."""

import hashlib
import html
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urljoin, urlparse

from archive_support import git, initialize_repository, offline_cli
from bs4 import BeautifulSoup

from copilot_mirror import FeedPost, archive_document_from_html, write_data_branch

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FIXTURES = PROJECT_ROOT / "tests" / "fixtures" / "production"


def normalized_text(value):
    return " ".join(html.unescape(value).split())


def assert_ordered_blocks(test, text, blocks):
    text = normalized_text(text)
    offset = 0
    for block in blocks:
        block = normalized_text(block)
        position = text.find(block, offset)
        test.assertGreaterEqual(position, offset, f"Missing or reordered editorial block: {block}")
        offset = position + len(block)


class ProductionArticleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        cls.repo = Path(cls.temp.name) / "repo"
        initialize_repository(cls.repo)
        cls.corpus = []
        inputs = {"posts/historical.md": b"An older post without a snapshot.\n"}
        baselines = []
        for path in sorted(FIXTURES.glob("*.json")):
            baseline = json.loads(path.read_text(encoding="utf-8"))
            raw = path.with_suffix(".html").read_bytes()
            inputs[f"snapshots/{path.stem}.html"] = raw
            inputs[f"snapshots/{path.stem}.json"] = json.dumps(
                {key: baseline[key] for key in ("source_url", "fetched_at")}
            ).encode()
            name = urlparse(baseline["source_url"]).path.rstrip("/").split("/")[-1]
            if "agentic-autofix" not in name and "dynamic-workflows" not in name:
                inputs[f"posts/{name}.md"] = (
                    f"---\nsource_url: {baseline['source_url']}\n---\n\nKnown-bad truncated body.\n"
                ).encode()
            baselines.append((name, baseline, raw))
        write_data_branch(
            cls.repo, "mirror-data", inputs, "Saved production fixtures and bad posts"
        )
        result = offline_cli(cls.repo, "render")
        if result.returncode:
            raise AssertionError(result.stderr)
        for name, baseline, raw in baselines:
            post = FeedPost("Discovery fallback title", baseline["source_url"], None)
            document = git(cls.repo, "show", f"mirror-data:posts/{name}.md").decode()
            cls.corpus.append((name, baseline, raw, post, document))
        for path, content in inputs.items():
            if not path.startswith("posts/") or path == "posts/historical.md":
                if git(cls.repo, "show", f"mirror-data:{path}") != content:
                    raise AssertionError(f"Render changed source or unrelated data: {path}")
        before = git(cls.repo, "rev-parse", "mirror-data")
        result = offline_cli(cls.repo, "render")
        if result.returncode or git(cls.repo, "rev-parse", "mirror-data") != before:
            raise AssertionError("Production corpus render must be idempotent")

    def test_captured_articles_preserve_all_ordered_editorial_blocks_in_archive_documents(self):
        self.assertEqual(len(self.corpus), 6)
        for name, baseline, raw, post, document in self.corpus:
            with self.subTest(snapshot=name):
                self.assertEqual(hashlib.sha256(raw).hexdigest(), baseline["sha256"])
                frontmatter, body = document.split("---\n", 2)[1:]
                # Frozen literals from reviewed source blocks, never recomputed by the parser.
                assert_ordered_blocks(
                    self, body, [block["markdown"] for block in baseline["blocks"]]
                )
                self.assertIn(
                    f"title: {json.dumps(baseline['title'], ensure_ascii=False)}", frontmatter
                )
                self.assertNotRegex(body, r"(?m)^# ")
                self.assertIn(f"source_url: {baseline['source_url']}", frontmatter)
                self.assertIn(f"fetched_at: {baseline['fetched_at']}", frontmatter)
                self.assertIn("published_at:", frontmatter)

    def test_captured_article_without_source_title_uses_discovery_fallback(self):
        _, baseline, raw, post, _ = self.corpus[0]
        soup = BeautifulSoup(raw, "html.parser")
        soup.h1.decompose()
        document = archive_document_from_html(post, str(soup).encode(), baseline["fetched_at"])
        self.assertIn('title: "Discovery fallback title"', document)
        assert_ordered_blocks(self, document, [block["markdown"] for block in baseline["blocks"]])

    @unittest.skipUnless(shutil.which("bundle"), "Ruby Bundler is required for the Jekyll build")
    def test_captured_articles_preserve_editorial_content_and_navigation_after_jekyll(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            source.mkdir()
            for name in ("_config.yml", "index.md"):
                shutil.copy(PROJECT_ROOT / name, source / name)
            for name in ("_layouts", "_includes", "_plugins"):
                shutil.copytree(PROJECT_ROOT / name, source / name)
            archive = source / "archive-source" / "posts"
            archive.mkdir(parents=True)
            for name, _, _, _, document in self.corpus:
                (archive / f"{name}.md").write_text(document, encoding="utf-8")
            subprocess.run(
                [
                    "python3",
                    str(PROJECT_ROOT / "scripts" / "stage_archive.py"),
                    str(archive),
                    str(source / "_archive"),
                ],
                check=True,
                capture_output=True,
            )
            destination = root / "site"
            result = subprocess.run(
                [
                    "bundle",
                    "exec",
                    "jekyll",
                    "build",
                    "--source",
                    str(source),
                    "--destination",
                    str(destination),
                    "--baseurl",
                    "/copilot-changelog-mirror",
                ],
                cwd=PROJECT_ROOT,
                env=os.environ.copy(),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            listing = BeautifulSoup((destination / "index.html").read_text(), "html.parser")
            for name, baseline, _, _, _ in self.corpus:
                with self.subTest(snapshot=name):
                    soup = BeautifulSoup(
                        (destination / "posts" / name / "index.html").read_text(), "html.parser"
                    )
                    article = soup.select_one("article")
                    content = article.select_one(".article-content")
                    assert_ordered_blocks(
                        self,
                        content.get_text(" ", strip=True),
                        [block["text"] for block in baseline["blocks"]],
                    )
                    self.assertEqual(
                        [h.get_text(strip=True) for h in article.find_all("h1")],
                        [baseline["title"]],
                    )
                    listing_link = listing.find(
                        "a", href=f"/copilot-changelog-mirror/posts/{name}/"
                    )
                    self.assertEqual(listing_link.get_text(strip=True), baseline["title"])
                    headings = content.find_all(["h2", "h3", "h4", "h5", "h6"])
                    self.assertEqual(
                        [h.get_text(" ", strip=True) for h in headings], baseline["headings"]
                    )
                    for chrome in (
                        "Table of Contents",
                        "Menu. Currently selected",
                        "Back to changelog",
                        "Copied",
                        "minute read",
                    ):
                        self.assertNotIn(chrome, content.get_text(" ", strip=True))
                    self.assertIsNone(content.find("a", string="Shared"))
                    heading_ids = {h.get("id") for h in headings}
                    fragments = content.select('a[href^="#"]')
                    self.assertEqual(len(fragments), len(baseline["headings"]))
                    for link in fragments:
                        self.assertIn(link["href"][1:], heading_ids)
                        target = content.find(id=link["href"][1:])
                        self.assertEqual(
                            link.get_text(" ", strip=True), target.get_text(" ", strip=True)
                        )
                    self.assertEqual(
                        [
                            {"src": i["src"], "alt": i.get("alt", "")}
                            for i in content.find_all("img")
                        ],
                        baseline["images"],
                    )
                    for href in baseline["links"]:
                        self.assertIsNotNone(
                            content.find("a", href=urljoin(baseline["source_url"], href))
                        )
                    self.assertEqual(
                        [el.get_text(" ", strip=True) for el in content.find_all("strong")],
                        baseline["strong"],
                    )
                    for tag, count in baseline["lists"].items():
                        self.assertEqual(len(content.find_all(tag)), count)
                    self.assertEqual(
                        [video.get("src") for video in content.find_all("video")],
                        baseline["videos"],
                    )


if __name__ == "__main__":
    unittest.main()
