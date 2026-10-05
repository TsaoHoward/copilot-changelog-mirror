import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from archive_support import git, initialize_repository, offline_cli

from copilot_mirror import write_data_branch

SOURCE_URL = "https://github.blog/changelog/2026-09-29-saved-article/"
FETCHED_AT = "2026-10-01T02:03:04.123456+00:00"


def snapshot_files(name="saved", url=SOURCE_URL, html=None, **metadata):
    provenance = {"source_url": url, "fetched_at": FETCHED_AT, **metadata}
    return {
        f"snapshots/{name}.html": html
        or b"<article><h1>Canonical title</h1><p>Saved body.</p></article>",
        f"snapshots/{name}.json": json.dumps(provenance).encode(),
    }


class RenderCliTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / "repo"
        initialize_repository(self.repo)

    def seed(self, files):
        write_data_branch(self.repo, "mirror-data", files, "Saved archive input")

    def test_invalid_snapshot_batches_fail_without_partial_changes(self):
        conflict_html = (
            '<script type="application/ld+json">'
            + json.dumps(
                [
                    {
                        "@type": "TechArticle",
                        "url": SOURCE_URL,
                        "datePublished": "2026-09-29T00:00:00Z",
                    },
                    {
                        "@type": "WebPage",
                        "url": SOURCE_URL,
                        "datePublished": "2026-09-30T00:00:00Z",
                    },
                ]
            )
            + "</script><article><p>Conflicting dates.</p></article>"
        ).encode()
        cases = [
            ({"snapshots/z-bad.json": None}, "cannot read"),
            ({"snapshots/z-bad.json": b"{"}, "JSON"),
            ({"snapshots/z-bad.json": b"[]"}, "provenance"),
            ({"snapshots/z-bad.html": b""}, "HTML"),
            ({"snapshots/z-bad.html": conflict_html}, "conflicting"),
        ]
        for field, value in (
            ("source_url", None),
            ("source_url", "not a URL"),
            ("source_url", "https:///missing-host"),
            ("source_url", SOURCE_URL + "\nInjected: field"),
            ("source_url", "https://example.com\x00/saved/"),
            ("fetched_at", None),
            ("fetched_at", 123),
            ("fetched_at", "yesterday"),
            ("fetched_at", "Thu, 01 Oct 2026 02:03:04 GMT\n---\n# Changed title"),
            ("fetched_at", "2026-10-01"),
            ("published_at", "invalid"),
            ("published_at", 123),
            ("published_at", ""),
            ("published_at", "Thu, 01 Oct 2026 02:03:04 GMT ignored suffix"),
            ("discovery_title", 123),
        ):
            cases.append(
                (
                    {
                        "snapshots/z-bad.json": json.dumps(
                            {"source_url": SOURCE_URL, "fetched_at": FETCHED_AT, field: value}
                        ).encode()
                    },
                    field,
                )
            )
        root = self.repo.parent
        for index, (changes, diagnostic) in enumerate(cases):
            with self.subTest(diagnostic=diagnostic, changes=changes):
                self.repo = root / f"invalid-{index}"
                initialize_repository(self.repo)
                files = snapshot_files("a-valid", url="https://example.com/valid/")
                files.update(snapshot_files("z-bad"))
                files["posts/old.md"] = b"Preserve previous posts.\n"
                files.update(changes)
                files = {path: content for path, content in files.items() if content is not None}
                self.seed(files)
                before = git(self.repo, "rev-parse", "mirror-data")
                result = offline_cli(self.repo, "render")
                self.assertNotEqual(result.returncode, 0, result.stdout)
                self.assertIn(diagnostic.casefold(), result.stderr.casefold())
                self.assertIn("z-bad", result.stderr)
                self.assertEqual(git(self.repo, "rev-parse", "mirror-data"), before)
                for path, content in files.items():
                    self.assertEqual(git(self.repo, "show", f"mirror-data:{path}"), content)

    def test_post_identity_collisions_fail_before_any_write(self):
        files = snapshot_files("one", url="https://example.com/one/shared/")
        files.update(snapshot_files("two", url="https://example.com/two/shared/"))
        self.seed(files)
        before = git(self.repo, "rev-parse", "mirror-data")
        result = offline_cli(self.repo, "render")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("collision", result.stderr)
        self.assertEqual(git(self.repo, "rev-parse", "mirror-data"), before)

    def test_conflicting_existing_post_source_fails(self):
        files = snapshot_files()
        files["posts/2026-09-29-saved-article.md"] = (
            b'---\nsource_url: "https://example.com/different/"\n---\nOld body.\n'
        )
        self.seed(files)
        before = git(self.repo, "rev-parse", "mirror-data")
        result = offline_cli(self.repo, "render")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("source_url", result.stderr)
        self.assertIn("2026-09-29-saved-article.md", result.stderr)
        self.assertEqual(git(self.repo, "rev-parse", "mirror-data"), before)

    def test_render_requires_saved_input_and_explicit_command(self):
        result = offline_cli(self.repo, "render")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("capture first", result.stderr)
        self.seed({"posts/older.md": b"Older post.\n"})
        before = git(self.repo, "rev-parse", "mirror-data")
        for arguments, diagnostic in (
            (("render",), "capture first"),
            ((), "capture"),
            (("--feed-url", "https://example.com/feed"), "capture"),
            (("render", "--feed-url", "https://example.com/feed"), "unrecognized"),
            (("collect",), "invalid choice"),
        ):
            with self.subTest(arguments=arguments):
                result = offline_cli(self.repo, *arguments)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(diagnostic, result.stderr)
                self.assertEqual(git(self.repo, "rev-parse", "mirror-data"), before)
        for arguments in (("--help",), ("capture", "--help"), ("render", "--help")):
            result = offline_cli(self.repo, *arguments)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_offline_harness_detects_source_acquisition_attempts(self):
        with self.assertRaisesRegex(AssertionError, "CLI attempted network access"):
            offline_cli(self.repo, "capture", "--feed-url", "https://example.invalid/feed")

    def test_saved_metadata_fallbacks_and_publication_precedence(self):
        records = [
            {
                "@type": "TechArticle",
                "mainEntityOfPage": {"@id": SOURCE_URL.rstrip("/")},
                "datePublished": "2026-09-29T10:02:27-07:00",
            },
            {"@type": "BlogPosting", "url": SOURCE_URL, "datePublished": "2026-09-29T17:02:27Z"},
            {"@type": "WebPage", "@id": SOURCE_URL, "datePublished": "2026-09-29T17:02:27+00:00"},
            {
                "@type": "WebPage",
                "url": "https://example.com/unrelated/",
                "datePublished": "2000-01-01T00:00:00Z",
            },
            {"@type": "ImageObject", "url": SOURCE_URL, "datePublished": "2001-01-01T00:00:00Z"},
        ]
        saved = (
            '<script type="application/ld+json">'
            + json.dumps({"@graph": records})
            + "</script><article><p>Saved body.</p></article>"
        ).encode()
        cases = (
            (
                {"discovery_title": "Discovery title"},
                saved,
                "Discovery title",
                "2026-09-29T17:02:27+00:00",
            ),
            ({}, saved, SOURCE_URL, "2026-09-29T17:02:27+00:00"),
            (
                {"published_at": "2026-09-28T09:00:00-07:00"},
                saved,
                SOURCE_URL,
                "2026-09-28T16:00:00+00:00",
            ),
            ({"published_at": None}, saved, SOURCE_URL, "2026-09-29T17:02:27+00:00"),
            (
                {},
                b'<script type="application/ld+json">{"dateModified":"2026-09-29T00:00:00Z"}</script><article><p>No publication.</p></article>',
                SOURCE_URL,
                None,
            ),
            ({"discovery_title": "Ignored fallback"}, None, "Canonical title", None),
        )
        for metadata, raw, title, published in cases:
            with self.subTest(metadata=metadata, title=title, published=published):
                files = snapshot_files(html=raw, **metadata)
                self.seed(files)
                result = offline_cli(self.repo, "render")
                self.assertEqual(result.returncode, 0, result.stderr)
                post = git(
                    self.repo, "show", "mirror-data:posts/2026-09-29-saved-article.md"
                ).decode()
                self.assertIn(f"title: {json.dumps(title)}", post)
                self.assertIn(f"fetched_at: {FETCHED_AT}", post)
                if published:
                    self.assertIn(f"published_at: {published}", post)
                else:
                    self.assertNotIn("published_at:", post)
                for path, content in files.items():
                    self.assertEqual(git(self.repo, "show", f"mirror-data:{path}"), content)

    def test_legacy_snapshots_render_offline_preserving_sources_and_old_posts(self):
        files = snapshot_files()
        files.update({"posts/old.md": b"Old historical post.\n", "archive-state.json": b"{}\n"})
        self.seed(files)
        before = git(self.repo, "rev-parse", "mirror-data").strip()
        result = offline_cli(self.repo, "render")
        self.assertEqual(result.returncode, 0, result.stderr)
        post = git(self.repo, "show", "mirror-data:posts/2026-09-29-saved-article.md").decode()
        self.assertIn('title: "Canonical title"', post)
        self.assertIn(f"source_url: {SOURCE_URL}", post)
        self.assertIn(f"fetched_at: {FETCHED_AT}", post)
        self.assertNotIn("published_at:", post)
        self.assertIn("Saved body.", post)
        self.assertEqual(git(self.repo, "rev-parse", "mirror-data^").strip(), before)
        for path, content in files.items():
            self.assertEqual(git(self.repo, "show", f"mirror-data:{path}"), content)
        rendered = git(self.repo, "rev-parse", "mirror-data")
        result = offline_cli(self.repo, "render")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(git(self.repo, "rev-parse", "mirror-data"), rendered)

    def test_changed_snapshot_updates_only_its_post_and_keeps_history(self):
        files = snapshot_files()
        files.update(snapshot_files("second", url="https://example.com/second/"))
        self.seed(files)
        self.assertEqual(offline_cli(self.repo, "render").returncode, 0)
        before = git(self.repo, "rev-parse", "mirror-data").decode().strip()
        old_post = git(self.repo, "show", "mirror-data:posts/2026-09-29-saved-article.md")
        changed = files["snapshots/saved.html"].replace(b"Saved body.", b"Changed saved body.")
        self.seed({"snapshots/saved.html": changed})
        captured = git(self.repo, "rev-parse", "mirror-data").decode().strip()
        result = offline_cli(self.repo, "render")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(git(self.repo, "rev-parse", "mirror-data^").decode().strip(), captured)
        self.assertEqual(
            git(self.repo, "diff", "--name-only", "mirror-data^", "mirror-data").decode(),
            "posts/2026-09-29-saved-article.md\n",
        )
        self.assertIn(
            b"Changed saved body.",
            git(self.repo, "show", "mirror-data:posts/2026-09-29-saved-article.md"),
        )
        self.assertEqual(
            git(self.repo, "show", f"{before}:posts/2026-09-29-saved-article.md"), old_post
        )
        self.assertEqual(
            git(self.repo, "show", f"{before}:snapshots/saved.html"), files["snapshots/saved.html"]
        )

    def test_fresh_clone_continues_remote_history_preserving_application_work(self):
        self.seed({**snapshot_files(), "posts/old.md": b"Historical body.\n"})
        origin = self.repo.parent / "origin.git"
        subprocess.run(
            ["git", "init", "--bare", "--initial-branch=main", str(origin)],
            check=True,
            capture_output=True,
        )
        git(self.repo, "remote", "add", "origin", str(origin))
        git(self.repo, "push", "origin", "main", "mirror-data")
        before = git(self.repo, "rev-parse", "mirror-data")
        clone = self.repo.parent / "clone"
        subprocess.run(["git", "clone", str(origin), str(clone)], check=True, capture_output=True)
        self.repo = clone
        git(clone, "config", "user.name", "Fixture User")
        git(clone, "config", "user.email", "fixture@example.invalid")
        refs = git(clone, "for-each-ref", "--format=%(refname)", "refs/heads/")
        self.assertNotIn(b"mirror-data", refs)
        (clone / "README.md").write_text("Staged local work.\n")
        git(clone, "add", "README.md")
        (clone / "README.md").write_text("Staged and unstaged local work.\n")
        (clone / "notes.txt").write_text("Untracked local notes.\n")
        application = {
            "head": git(clone, "rev-parse", "HEAD"),
            "status": git(clone, "status", "--porcelain"),
            "index": git(clone, "show", ":README.md"),
        }
        result = offline_cli(clone, "render")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(git(clone, "rev-parse", "mirror-data^"), before)
        self.assertEqual(git(clone, "show", "mirror-data:posts/old.md"), b"Historical body.\n")
        self.assertEqual(git(clone, "rev-parse", "HEAD"), application["head"])
        self.assertEqual(git(clone, "status", "--porcelain"), application["status"])
        self.assertEqual(git(clone, "show", ":README.md"), application["index"])
        self.assertEqual(git(clone, "branch", "--show-current"), b"main\n")
        self.assertEqual((clone / "README.md").read_text(), "Staged and unstaged local work.\n")
        self.assertEqual((clone / "notes.txt").read_text(), "Untracked local notes.\n")

    def test_normalization_failure_leaves_whole_batch_unchanged(self):
        self.seed(snapshot_files())
        guard = self.repo.parent / "network-guard"
        guard.mkdir()
        (guard / "markdownify.py").write_text(
            "raise RuntimeError('Normalization dependency unavailable')\n"
        )
        before = git(self.repo, "rev-parse", "mirror-data")
        result = offline_cli(self.repo, "render")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("snapshots/saved.html", result.stderr)
        self.assertIn("Normalization dependency unavailable", result.stderr)
        self.assertEqual(git(self.repo, "rev-parse", "mirror-data"), before)


if __name__ == "__main__":
    unittest.main()
