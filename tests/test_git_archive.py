import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))
from copilot_mirror import write_archive_branch


class GitArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp_dir.name)
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.name", "Fixture User")
        self.git("config", "user.email", "fixture@example.invalid")
        (self.repo / "README.md").write_text("Application code stays on main.\n")
        self.git("add", "README.md")
        self.git("commit", "-qm", "initial")

    def tearDown(self):
        self.temp_dir.cleanup()

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.repo, check=True, capture_output=True, text=True)

    def test_archive_branch_is_created_updated_and_unchanged_runs_are_noops(self):
        self.assertTrue(write_archive_branch(self.repo, "mirror-data", {"sample.md": "first version\n"}))
        initial_commit = self.git("rev-parse", "mirror-data").stdout.strip()
        self.assertEqual(self.git("ls-tree", "--name-only", "mirror-data").stdout.strip(), "posts")
        self.assertEqual(self.git("status", "--porcelain").stdout, "")
        self.assertEqual(self.git("branch", "--show-current").stdout.strip(), "main")

        self.assertFalse(write_archive_branch(self.repo, "mirror-data", {"sample.md": "first version\n"}))
        self.assertEqual(self.git("rev-parse", "mirror-data").stdout.strip(), initial_commit)

        self.assertTrue(write_archive_branch(self.repo, "mirror-data", {"sample.md": "updated version\n"}))
        updated_commit = self.git("rev-parse", "mirror-data").stdout.strip()
        self.assertNotEqual(updated_commit, initial_commit)
        self.assertEqual(self.git("show", "mirror-data:posts/sample.md").stdout, "updated version\n")
        self.assertEqual(self.git("status", "--porcelain").stdout, "")
        self.assertEqual(self.git("branch", "--show-current").stdout.strip(), "main")


if __name__ == "__main__":
    unittest.main()
