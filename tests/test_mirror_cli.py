import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime
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
        (self.fixtures / "article.html").write_text("""<html><body><article><h1>Fixture update</h1>
          <p>Full <strong>article</strong> text.</p><ul><li>First point</li></ul>
          <pre><code>def add(a, b):
    total = a + b
    return total
</code></pre>
          <img src="chart.png" alt="Chart"><p>Final paragraph.</p>
          </article><footer>Site footer content</footer></body></html>""")
        (self.fixtures / "no-date.html").write_text((self.fixtures / "article.html").read_text())
        (self.fixtures / "updated-only.html").write_text(
            (self.fixtures / "article.html").read_text()
        )
        article_url = (self.fixtures / "article.html").as_uri()
        no_date_url = (self.fixtures / "no-date.html").as_uri()
        updated_only_url = (self.fixtures / "updated-only.html").as_uri()
        feed = f"""<?xml version="1.0"?><rss><channel><item>
          <title>Copilot fixture update</title><link>{article_url}</link><guid>fixture-1</guid>
          <pubDate>Tue, 29 Sep 2026 12:30:00 GMT</pubDate>
        </item><item><title>No publication date</title><link>{no_date_url}</link></item>
        <item><title>Updated but not published</title><link>{updated_only_url}</link>
          <updated>Wed, 30 Sep 2026 12:30:00 GMT</updated></item>
        </channel></rss>"""
        (self.fixtures / "feed.xml").write_text(feed)

    def tearDown(self):
        self.temp_dir.cleanup()

    def git(self, *args):
        return subprocess.run(
            ["git", *args], cwd=self.repo, check=True, capture_output=True, text=True
        )

    def run_cli(self, *arguments):
        return subprocess.run(
            [
                sys.executable,
                "-m",
                "copilot_mirror",
                *arguments,
                "--repo",
                str(self.repo),
                "--feed-url",
                (self.fixtures / "feed.xml").as_uri(),
            ],
            cwd=PROJECT_ROOT,
            env={**os.environ, "PYTHONPATH": str(PROJECT_ROOT / "src")},
            check=True,
            capture_output=True,
            text=True,
        )

    def git_bytes(self, *args):
        return subprocess.run(
            ["git", *args], cwd=self.repo, check=True, capture_output=True
        ).stdout

    def add_archive_file(self, path, content):
        worktree = self.repo.parent / "archive-worktree"
        subprocess.run(
            ["git", "-C", str(self.repo), "worktree", "add", str(worktree), "mirror-data"],
            check=True,
            capture_output=True,
        )
        try:
            destination = worktree / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)
            subprocess.run(
                ["git", "-C", str(worktree), "add", "--", path],
                check=True,
                capture_output=True,
            )
            subprocess.run(
                ["git", "-C", str(worktree), "commit", "-m", "Add unrelated archive data"],
                check=True,
                capture_output=True,
            )
        finally:
            subprocess.run(
                ["git", "-C", str(self.repo), "worktree", "remove", "--force", str(worktree)],
                check=True,
                capture_output=True,
            )

    def test_cli_archives_article_with_provenance_on_separate_branch_idempotently(self):
        self.run_cli()

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
        self.assertIn("```\ndef add(a, b):\n    total = a + b\n    return total\n```", archived)
        self.assertNotIn("Site footer content", archived)
        optional_date = self.git("show", f"mirror-data:{paths[1]}").stdout
        self.assertNotIn("published_at:", optional_date)
        updated_only = self.git("show", f"mirror-data:{paths[2]}").stdout
        self.assertNotIn("published_at:", updated_only)

        first_commit = self.git("rev-parse", "mirror-data").stdout.strip()
        self.run_cli()
        self.assertEqual(self.git("rev-parse", "mirror-data").stdout.strip(), first_commit)
        self.assertEqual(self.git("branch", "--show-current").stdout.strip(), "main")

        article_path = self.fixtures / "article.html"
        article_path.write_text(article_path.read_text().replace("Full", "Updated"))
        self.run_cli()
        updated_commit = self.git("rev-parse", "mirror-data").stdout.strip()
        self.assertNotEqual(updated_commit, first_commit)
        updated = self.git("show", f"mirror-data:{paths[0]}").stdout
        self.assertIn("Updated **article** text.", updated)
        self.assertEqual(self.git("branch", "--show-current").stdout.strip(), "main")

    def test_capture_persists_raw_html_and_provenance_without_changing_posts(self):
        self.run_cli()
        self.add_archive_file("archive-state.json", b"{\"preserve\": true}\n")
        existing_archive = {
            path: self.git_bytes("show", f"mirror-data:{path}")
            for path in self.git("ls-tree", "-r", "--name-only", "mirror-data")
            .stdout.splitlines()
        }
        self.assertIn("archive-state.json", existing_archive)

        self.run_cli("capture")
        paths = self.git("ls-tree", "-r", "--name-only", "mirror-data").stdout.splitlines()
        snapshot_paths = [path for path in paths if path.startswith("snapshots/")]
        self.assertEqual(len(snapshot_paths), 6)

        captured = {}
        for path in snapshot_paths:
            if path.endswith(".html"):
                metadata_path = path.removesuffix(".html") + ".json"
                raw_html = self.git_bytes("show", f"mirror-data:{path}")
                metadata = json.loads(self.git_bytes("show", f"mirror-data:{metadata_path}"))
                captured[metadata["source_url"]] = (path, raw_html, metadata)
                fetched_at = datetime.fromisoformat(
                    metadata["fetched_at"].replace("Z", "+00:00")
                )
                self.assertEqual(fetched_at.utcoffset().total_seconds(), 0)

        for article_name in ("article.html", "no-date.html", "updated-only.html"):
            url = (self.fixtures / article_name).as_uri()
            self.assertEqual(captured[url][1], (self.fixtures / article_name).read_bytes())
            self.assertEqual(captured[url][2]["source_url"], url)

        first_commit = self.git("rev-parse", "mirror-data").stdout.strip()
        first_snapshot = {
            path: self.git_bytes("show", f"mirror-data:{path}") for path in snapshot_paths
        }
        self.run_cli("capture")
        self.assertEqual(self.git("rev-parse", "mirror-data").stdout.strip(), first_commit)
        self.assertEqual(
            {
                path: self.git_bytes("show", f"mirror-data:{path}")
                for path in snapshot_paths
            },
            first_snapshot,
        )

        article_path = self.fixtures / "article.html"
        updated_html = article_path.read_bytes().replace(b"Full", b"Updated")
        article_path.write_bytes(updated_html)
        self.run_cli("capture")
        changed_path = captured[(self.fixtures / "article.html").as_uri()][0]
        self.assertEqual(self.git_bytes("show", f"mirror-data:{changed_path}"), updated_html)
        metadata_path = changed_path.removesuffix(".html") + ".json"
        updated_metadata = json.loads(self.git_bytes("show", f"mirror-data:{metadata_path}"))
        self.assertNotEqual(
            updated_metadata["fetched_at"],
            captured[(self.fixtures / "article.html").as_uri()][2]["fetched_at"],
        )
        self.assertEqual(
            self.git_bytes("show", f"mirror-data^:{changed_path}"),
            first_snapshot[changed_path],
        )

        remaining_paths = self.git(
            "ls-tree", "-r", "--name-only", "mirror-data"
        ).stdout.splitlines()
        for path, content in existing_archive.items():
            self.assertIn(path, remaining_paths)
            self.assertEqual(self.git_bytes("show", f"mirror-data:{path}"), content)
        self.assertEqual(self.git("branch", "--show-current").stdout.strip(), "main")
        self.assertEqual(self.git("status", "--porcelain").stdout, "")


if __name__ == "__main__":
    unittest.main()
