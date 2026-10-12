import subprocess
import tempfile
import unittest
from pathlib import Path

from copilot_mirror import write_archive_branch


class GitArchiveTests(unittest.TestCase):
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

    def tearDown(self):
        self.temp_dir.cleanup()

    def git(self, *args):
        return subprocess.run(
            ["git", *args], cwd=self.repo, check=True, capture_output=True, text=True
        )

    def test_archive_branch_is_created_updated_and_unchanged_runs_are_noops(self):
        self.assertTrue(
            write_archive_branch(self.repo, "mirror-data", {"sample.md": "first version\n"})
        )
        initial_commit = self.git("rev-parse", "mirror-data").stdout.strip()
        self.assertEqual(self.git("ls-tree", "--name-only", "mirror-data").stdout.strip(), "posts")
        self.assertEqual(self.git("status", "--porcelain").stdout, "")
        self.assertEqual(self.git("branch", "--show-current").stdout.strip(), "main")

        self.assertFalse(
            write_archive_branch(self.repo, "mirror-data", {"sample.md": "first version\n"})
        )
        self.assertEqual(self.git("rev-parse", "mirror-data").stdout.strip(), initial_commit)

        self.assertTrue(
            write_archive_branch(self.repo, "mirror-data", {"sample.md": "updated version\n"})
        )
        updated_commit = self.git("rev-parse", "mirror-data").stdout.strip()
        self.assertNotEqual(updated_commit, initial_commit)
        self.assertEqual(
            self.git("show", "mirror-data:posts/sample.md").stdout, "updated version\n"
        )
        self.assertEqual(self.git("status", "--porcelain").stdout, "")
        self.assertEqual(self.git("branch", "--show-current").stdout.strip(), "main")

    def test_fresh_clone_continues_remote_archive_branch_and_preserves_posts(self):
        origin = self.repo.parent / "origin.git"
        subprocess.run(
            ["git", "init", "--bare", "--initial-branch=main", str(origin)],
            check=True,
            capture_output=True,
        )
        self.git("remote", "add", "origin", str(origin))
        self.git("push", "-u", "origin", "main")
        self.assertTrue(
            write_archive_branch(
                self.repo, "mirror-data", {"older-post.md": "archived before clone\n"}
            )
        )
        self.git("push", "origin", "mirror-data")
        remote_data_commit = subprocess.run(
            ["git", "--git-dir", str(origin), "rev-parse", "refs/heads/mirror-data"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

        fresh_clone = self.repo.parent / "fresh-clone"
        subprocess.run(
            ["git", "clone", str(origin), str(fresh_clone)], check=True, capture_output=True
        )
        for key, value in (
            ("user.name", "Fixture User"),
            ("user.email", "fixture@example.invalid"),
        ):
            subprocess.run(["git", "-C", str(fresh_clone), "config", key, value], check=True)
        self.assertNotEqual(
            subprocess.run(
                [
                    "git",
                    "-C",
                    str(fresh_clone),
                    "show-ref",
                    "--verify",
                    "--quiet",
                    "refs/heads/mirror-data",
                ]
            ).returncode,
            0,
        )
        self.assertEqual(
            subprocess.run(
                ["git", "-C", str(fresh_clone), "rev-parse", "origin/mirror-data"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip(),
            remote_data_commit,
        )

        self.assertTrue(
            write_archive_branch(fresh_clone, "mirror-data", {"new-post.md": "newer post\n"})
        )
        self.assertEqual(
            subprocess.run(
                ["git", "-C", str(fresh_clone), "rev-parse", "mirror-data^"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip(),
            remote_data_commit,
        )
        self.assertEqual(
            subprocess.run(
                ["git", "-C", str(fresh_clone), "show", "mirror-data:posts/older-post.md"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout,
            "archived before clone\n",
        )
        self.assertEqual(
            subprocess.run(
                ["git", "-C", str(fresh_clone), "show", "mirror-data:posts/new-post.md"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout,
            "newer post\n",
        )
        self.assertEqual(self.git("branch", "--show-current").stdout.strip(), "main")
        self.assertEqual(
            subprocess.run(
                ["git", "-C", str(fresh_clone), "branch", "--show-current"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip(),
            "main",
        )


if __name__ == "__main__":
    unittest.main()
