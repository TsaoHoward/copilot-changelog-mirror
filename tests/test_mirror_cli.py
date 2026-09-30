import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
class MirrorCliTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp_dir.name) / "repo"
        self.repo.mkdir()
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.name", "Fixture User")
        self.git("config", "user.email", "fixture@example.invalid")
        (self.repo / "README.md").write_text("Application code stays on main.\n")
        self.git("add", "README.md")
        self.git("commit", "-qm", "initial")
        self.fixtures = Path(self.temp_dir.name) / "fixtures"
        self.fixtures.mkdir()
        (self.fixtures / "article.html").write_text('''<html><body><article><h1>Fixture update</h1>
          <p>Full <strong>article</strong> text.</p><ul><li>First point</li></ul>
          <img src="chart.png" alt="Chart"><p>Final paragraph.</p>
          </article><footer>Site footer content</footer></body></html>''')
        (self.fixtures / "no-date.html").write_text((self.fixtures / "article.html").read_text())
        (self.fixtures / "updated-only.html").write_text((self.fixtures / "article.html").read_text())
        article_url = (self.fixtures / "article.html").as_uri()
        no_date_url = (self.fixtures / "no-date.html").as_uri()
        updated_only_url = (self.fixtures / "updated-only.html").as_uri()
        feed = f'''<?xml version="1.0"?><rss><channel><item>
          <title>Copilot fixture update</title><link>{article_url}</link><guid>fixture-1</guid>
          <pubDate>Tue, 29 Sep 2026 12:30:00 GMT</pubDate>
        </item><item><title>No publication date</title><link>{no_date_url}</link></item>
        <item><title>Updated but not published</title><link>{updated_only_url}</link>
          <updated>Wed, 30 Sep 2026 12:30:00 GMT</updated></item>
        </channel></rss>'''
        (self.fixtures / "feed.xml").write_text(feed)

    def tearDown(self):
        self.temp_dir.cleanup()

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.repo, check=True, capture_output=True, text=True)

    def run_mirror(self):
        return subprocess.run(
            [sys.executable, "-m", "copilot_mirror", "--repo", str(self.repo),
             "--feed-url", (self.fixtures / "feed.xml").as_uri()],
            cwd=PROJECT_ROOT,
            env={**os.environ, "PYTHONPATH": str(PROJECT_ROOT / "src")},
            check=True, capture_output=True, text=True,
        )

    def test_cli_archives_article_with_provenance_on_separate_branch_idempotently(self):
        self.run_mirror()

        self.assertEqual(self.git("branch", "--show-current").stdout.strip(), "main")
        self.assertEqual(self.git("status", "--porcelain").stdout, "")
        self.assertEqual(self.git("ls-tree", "--name-only", "mirror-data").stdout.strip(), "posts")
        paths = self.git("ls-tree", "-r", "--name-only", "mirror-data").stdout.splitlines()
        self.assertEqual(len(paths), 3)
        archived = self.git("show", f"mirror-data:{paths[0]}").stdout
        self.assertIn("source_url: file://", archived)
        self.assertIn("published_at: 2026-09-29T12:30:00+00:00", archived)
        self.assertIn("fetched_at:", archived)
        self.assertIn("Full **article** text.", archived)
        self.assertIn("- First point", archived)
        self.assertIn("![Chart](chart.png)", archived)
        self.assertNotIn("Site footer content", archived)
        optional_date = self.git("show", f"mirror-data:{paths[1]}").stdout
        self.assertNotIn("published_at:", optional_date)
        updated_only = self.git("show", f"mirror-data:{paths[2]}").stdout
        self.assertNotIn("published_at:", updated_only)

        first_commit = self.git("rev-parse", "mirror-data").stdout.strip()
        self.run_mirror()
        self.assertEqual(self.git("rev-parse", "mirror-data").stdout.strip(), first_commit)
        self.assertEqual(self.git("branch", "--show-current").stdout.strip(), "main")

        article_path = self.fixtures / "article.html"
        article_path.write_text(article_path.read_text().replace("Full", "Updated"))
        self.run_mirror()
        updated_commit = self.git("rev-parse", "mirror-data").stdout.strip()
        self.assertNotEqual(updated_commit, first_commit)
        updated = self.git("show", f"mirror-data:{paths[0]}").stdout
        self.assertIn("Updated **article** text.", updated)
        self.assertEqual(self.git("branch", "--show-current").stdout.strip(), "main")


if __name__ == "__main__":
    unittest.main()
