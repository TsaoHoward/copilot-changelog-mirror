import re
import unittest
from pathlib import Path

from copilot_mirror import FeedPost, archive_document_from_html

PROJECT_ROOT = Path(__file__).resolve().parents[1]

FIXTURE = PROJECT_ROOT / "tests" / "fixtures" / "github_changelog_article.html"
FETCHED_AT = "2026-10-02T00:00:00+00:00"


class ArticleNormalizationTests(unittest.TestCase):
    def setUp(self):
        self.post = FeedPost(
            title="Discovery title from the Copilot feed",
            url="https://github.blog/changelog/copilot-debugging-fixture/",
            published_at="2026-10-01T12:30:00+00:00",
        )
        self.source_html = FIXTURE.read_bytes()

    def test_archive_document_separates_canonical_title_and_normalized_body(self):
        document = archive_document_from_html(self.post, self.source_html, FETCHED_AT)
        frontmatter, body = document.split("---\n", 2)[1:]

        self.assertIn('title: "Improved debugging with Copilot Chat"', frontmatter)
        self.assertNotRegex(body, r"(?m)^# Improved debugging with Copilot Chat$")
        self.assertIn("Copilot Chat uses a stack trace", body)
        self.assertIn("**clearer debugging steps**", body)
        self.assertIn("- Explain the failed operation.", body)
        self.assertIn("https://docs.example.test/debugging", body)
        self.assertIn("![Debug trace screenshot]", body)
        self.assertIn("def first_frame(lines):", body)
        self.assertNotIn("Copied", body)
        self.assertNotIn("Shared", body)
        self.assertNotIn("Back to changelog", body)
        self.assertNotIn("Menu. Currently selected", body)
        self.assertNotIn("Improvement", body)
        self.assertNotIn("copilot", body)
        self.assertEqual(body.count("Table of Contents"), 1)

    def test_discovery_title_is_used_when_source_has_no_title(self):
        source_without_title = re.sub(
            r"\s*<h1>Improved debugging with Copilot Chat</h1>",
            "",
            self.source_html.decode("utf-8"),
        ).encode("utf-8")

        document = archive_document_from_html(self.post, source_without_title, FETCHED_AT)

        self.assertIn('title: "Discovery title from the Copilot feed"', document)

    def test_normalized_archive_document_is_stable_for_identical_input(self):
        first = archive_document_from_html(self.post, self.source_html, FETCHED_AT)
        second = archive_document_from_html(self.post, self.source_html, FETCHED_AT)

        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
