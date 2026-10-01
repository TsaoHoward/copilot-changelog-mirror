import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = PROJECT_ROOT / ".github" / "workflows" / "publish-pages.yml"


def yaml_block(lines, header, indent):
    marker = " " * indent + header
    start = next(index for index, line in enumerate(lines) if line == marker)
    end = start + 1
    while end < len(lines):
        line = lines[end]
        if line.strip() and len(line) - len(line.lstrip()) <= indent:
            break
        end += 1
    return lines[start:end]


def list_item_blocks(lines, indent):
    starts = [
        index
        for index, line in enumerate(lines)
        if len(line) - len(line.lstrip()) == indent and line.lstrip().startswith("- ")
    ]
    blocks = []
    for item_index, start in enumerate(starts):
        end = starts[item_index + 1] if item_index + 1 < len(starts) else len(lines)
        blocks.append(lines[start:end])
    return blocks


class PagesWorkflowTests(unittest.TestCase):
    def test_workflow_manually_builds_and_deploys_mirror_data(self):
        lines = WORKFLOW.read_text(encoding="utf-8").splitlines()
        triggers = yaml_block(lines, "on:", 0)
        root_permissions = yaml_block(lines, "permissions:", 0)
        jobs = yaml_block(lines, "jobs:", 0)
        build = yaml_block(jobs, "build:", 2)
        build_steps = yaml_block(build, "steps:", 4)
        deploy = yaml_block(jobs, "deploy:", 2)
        deploy_permissions = yaml_block(deploy, "permissions:", 4)
        deploy_steps = yaml_block(deploy, "steps:", 4)
        build_step_blocks = ["\n".join(block) for block in list_item_blocks(build_steps, 6)]
        deploy_step_blocks = ["\n".join(block) for block in list_item_blocks(deploy_steps, 6)]

        self.assertIn("  workflow_dispatch:", triggers)
        self.assertFalse(any("schedule:" in line for line in triggers))
        self.assertIn("  contents: read", root_permissions)
        self.assertTrue(
            any(
                "Check out archive branch" in block and "ref: mirror-data" in block
                for block in build_step_blocks
            )
        )
        self.assertTrue(
            any("mirror-data has no Markdown posts" in block for block in build_step_blocks)
        )
        self.assertTrue(any("bundle exec jekyll build" in block for block in build_step_blocks))
        self.assertTrue(
            any("actions/upload-pages-artifact@v4" in block for block in build_step_blocks)
        )
        self.assertIn("      pages: write", deploy_permissions)
        self.assertIn("      id-token: write", deploy_permissions)
        self.assertTrue(any("actions/deploy-pages@v4" in block for block in deploy_step_blocks))
        self.assertNotIn("copilot-mirror", WORKFLOW.read_text(encoding="utf-8"))


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
            shutil.copytree(PROJECT_ROOT / "_plugins", source / "_plugins", dirs_exist_ok=True)
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

![Fixture chart](images/chart.png)

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
            self.assertIn("Fixture update", listing)
            self.assertNotIn("Available date", listing)
            self.assertIn("All posts", article)
            self.assertIn("Fixture update", article)
            self.assertIn("https://github.blog/changelog/copilot-fixture/", article)
            self.assertIn("2026-09-29T12:30:00+00:00", article)
            self.assertIn("2026-10-01T01:00:00+00:00", article)
            self.assertIn("The <strong>full article</strong> is preserved", article)
            self.assertIn('<a href="https://example.com">links</a>', article)
            self.assertIn("<li>First point</li>", article)
            self.assertIn(
                'src="https://github.blog/changelog/copilot-fixture/images/chart.png"', article
            )
            self.assertIn("article code", article)
            self.assertIn("No publication time was available.", no_date)
            self.assertNotIn("Published", no_date)
            self.assertIn("/copilot-changelog-mirror/", article)


if __name__ == "__main__":
    unittest.main()
