import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = PROJECT_ROOT / ".github" / "workflows" / "publish-pages.yml"


class PagesWorkflowTests(unittest.TestCase):
    def test_workflow_manually_builds_and_deploys_mirror_data(self):
        workflow = WORKFLOW.read_text(encoding="utf-8")

        self.assertIn("workflow_dispatch:", workflow)
        self.assertNotIn("schedule:", workflow)
        self.assertIn("ref: mirror-data", workflow)
        self.assertIn("pages: write", workflow)
        self.assertIn("id-token: write", workflow)
        self.assertIn("actions/upload-pages-artifact@v4", workflow)
        self.assertIn("actions/deploy-pages@v4", workflow)
        self.assertIn("bundle exec jekyll build", workflow)
        self.assertIn("mirror-data has no Markdown posts", workflow)
        self.assertNotIn("copilot-mirror", workflow)


@unittest.skipUnless(shutil.which("bundle"), "Ruby Bundler is required for the Jekyll build")
class PagesArtifactTests(unittest.TestCase):
    def test_fixture_archive_builds_browsable_pages_with_provenance(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            (source / "_layouts").mkdir(parents=True)
            (source / "_archive").mkdir()
            shutil.copy(PROJECT_ROOT / "_config.yml", source / "_config.yml")
            shutil.copy(PROJECT_ROOT / "index.md", source / "index.md")
            shutil.copytree(PROJECT_ROOT / "_layouts", source / "_layouts", dirs_exist_ok=True)
            (source / "_archive" / "available-date.md").write_text(
                """---
source_url: https://github.blog/changelog/copilot-fixture/
published_at: 2026-09-29T12:30:00+00:00
fetched_at: 2026-10-01T01:00:00+00:00
---

# Fixture update

The **full article** is preserved, including [links](https://example.com) and lists:

- First point
- Second point

```python
print("article code")
```
""",
                encoding="utf-8",
            )
            (source / "_archive" / "no-date.md").write_text(
                """---
source_url: https://github.blog/changelog/copilot-no-date/
fetched_at: 2026-10-01T01:01:00+00:00
---

No publication time was available.
""",
                encoding="utf-8",
            )

            destination = root / "_site"
            subprocess.run(
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
                check=True,
                capture_output=True,
                text=True,
            )

            listing = (destination / "index.html").read_text(encoding="utf-8")
            article_path = destination / "posts" / "available-date" / "index.html"
            article = article_path.read_text(encoding="utf-8")
            no_date = (destination / "posts" / "no-date" / "index.html").read_text(encoding="utf-8")

            self.assertIn("/copilot-changelog-mirror/posts/available-date/", listing)
            self.assertIn("/copilot-changelog-mirror/posts/no-date/", listing)
            self.assertIn("All posts", article)
            self.assertIn("Fixture update", article)
            self.assertIn("https://github.blog/changelog/copilot-fixture/", article)
            self.assertIn("2026-09-29T12:30:00+00:00", article)
            self.assertIn("2026-10-01T01:00:00+00:00", article)
            self.assertIn("The <strong>full article</strong> is preserved", article)
            self.assertIn('<a href="https://example.com">links</a>', article)
            self.assertIn("<li>First point</li>", article)
            self.assertIn("article code", article)
            self.assertIn("No publication time was available.", no_date)
            self.assertNotIn("Published", no_date)
            self.assertIn("/copilot-changelog-mirror/", article)


if __name__ == "__main__":
    unittest.main()
