import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = PROJECT_ROOT / ".github" / "workflows" / "publish-pages.yml"
ORCHESTRATION_WORKFLOW = PROJECT_ROOT / ".github" / "workflows" / "mirror-and-publish.yml"
CI_WORKFLOW = PROJECT_ROOT / ".github" / "workflows" / "ci.yml"


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
        build_commands = [
            line.strip().removeprefix("run: ")
            for block in build_step_blocks
            for line in block.splitlines()
            if line.strip().startswith("run: ")
        ]
        action_refs = [
            line.strip().split("uses: ", 1)[1].split("@", 1)[1].split()[0]
            for block in [*build_step_blocks, *deploy_step_blocks]
            for line in block.splitlines()
            if "uses: " in line
        ]

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
            any(
                "scripts/stage_archive.py archive-source/posts _archive" in block
                for block in build_step_blocks
            )
        )
        self.assertTrue(any("bundle exec jekyll build" in block for block in build_step_blocks))
        self.assertTrue(action_refs)
        self.assertTrue(
            all(
                len(ref) == 40 and all(char in "0123456789abcdef" for char in ref)
                for ref in action_refs
            )
        )
        self.assertCountEqual(
            build_commands,
            [
                "python3 scripts/stage_archive.py archive-source/posts _archive",
                'bundle exec jekyll build --baseurl "/${GITHUB_REPOSITORY#*/}"',
            ],
        )
        self.assertTrue(
            any(
                "actions/upload-pages-artifact@7b1f4a764d45c48632c6b24a0339c27f5614fb0b" in block
                for block in build_step_blocks
            )
        )
        self.assertIn("      pages: write", deploy_permissions)
        self.assertIn("      id-token: write", deploy_permissions)
        self.assertTrue(
            any(
                "actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e" in block
                for block in deploy_step_blocks
            )
        )

    def test_workflow_can_be_called_after_mirror_while_remaining_manually_runnable(self):
        lines = WORKFLOW.read_text(encoding="utf-8").splitlines()
        triggers = yaml_block(lines, "on:", 0)

        self.assertIn("  workflow_dispatch:", triggers)
        self.assertIn("  workflow_call:", triggers)


class OrchestrationWorkflowTests(unittest.TestCase):
    def test_schedules_and_manual_trigger_run_the_mirror_then_reusable_pages_workflow(self):
        lines = ORCHESTRATION_WORKFLOW.read_text(encoding="utf-8").splitlines()
        triggers = yaml_block(lines, "on:", 0)
        schedule = yaml_block(triggers, "schedule:", 2)
        root_permissions = yaml_block(lines, "permissions:", 0)
        jobs = yaml_block(lines, "jobs:", 0)
        mirror = yaml_block(jobs, "mirror:", 2)
        mirror_permissions = yaml_block(mirror, "permissions:", 4)
        mirror_steps = yaml_block(mirror, "steps:", 4)
        publish = yaml_block(jobs, "publish:", 2)
        publish_permissions = yaml_block(publish, "permissions:", 4)
        mirror_step_blocks = ["\n".join(block) for block in list_item_blocks(mirror_steps, 6)]
        mirror_commands = [
            line.strip().removeprefix("run: ")
            for block in mirror_step_blocks
            for line in block.splitlines()
            if line.strip().startswith("run: ")
        ]
        schedule_config = [line.strip().removeprefix("- ") for line in schedule]
        trigger_config = [line.strip() for line in triggers]
        mirror_permission_config = [line.strip() for line in mirror_permissions]
        publish_permission_config = [line.strip() for line in publish_permissions]

        self.assertEqual(
            [line for line in schedule_config if line.startswith("cron:")],
            ['cron: "17 6,12 * * *"'],
        )
        self.assertIn('timezone: "Asia/Taipei"', schedule_config)
        self.assertIn("workflow_dispatch:", trigger_config)
        self.assertNotIn("contents: write", [line.strip() for line in root_permissions])
        self.assertIn("contents: write", mirror_permission_config)
        self.assertEqual(len(mirror_permission_config), 2)
        self.assertIn("needs: mirror", [line.strip() for line in publish])
        self.assertIn(
            "uses: ./.github/workflows/publish-pages.yml",
            [line.strip() for line in publish],
        )
        self.assertCountEqual(
            publish_permission_config,
            [
                "permissions:",
                "contents: read",
                "pages: write",
                "id-token: write",
            ],
        )
        fetch_command = "git fetch origin mirror-data:refs/remotes/origin/mirror-data"
        mirror_command = "uv run copilot-mirror"
        push_command = "git push origin mirror-data"
        self.assertLess(mirror_commands.index(fetch_command), mirror_commands.index(mirror_command))
        self.assertLess(mirror_commands.index(mirror_command), mirror_commands.index(push_command))

    def test_ci_installs_locked_jekyll_dependencies_before_running_tests(self):
        lines = CI_WORKFLOW.read_text(encoding="utf-8").splitlines()
        jobs = yaml_block(lines, "jobs:", 0)
        python_job = yaml_block(jobs, "python:", 2)
        steps = yaml_block(python_job, "steps:", 4)
        step_blocks = ["\n".join(block) for block in list_item_blocks(steps, 6)]
        ruby_step = next(block for block in step_blocks if "ruby/setup-ruby@" in block)
        test_step_index = next(
            index for index, block in enumerate(step_blocks) if "unittest discover" in block
        )

        self.assertIn('ruby-version: "3.3"', ruby_step)
        self.assertIn("bundler-cache: true", ruby_step)
        self.assertTrue(
            all(
                len(ref) == 40 and all(char in "0123456789abcdef" for char in ref)
                for ref in [ruby_step.split("ruby/setup-ruby@", 1)[1].split()[0]]
            )
        )
        self.assertTrue(test_step_index > step_blocks.index(ruby_step))
        self.assertTrue((PROJECT_ROOT / "Gemfile.lock").is_file())


class ArchiveStagingTests(unittest.TestCase):
    def test_stages_markdown_from_issue_2_posts_directory(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            posts = root / "archive-source" / "posts"
            posts.mkdir(parents=True)
            (posts / "fixture.md").write_text(
                "---\nsource_url: https://example.com/post/\nfetched_at: 2026-10-01T00:00:00Z\n---\n\nBody.\n",
                encoding="utf-8",
            )
            destination = root / "_archive"

            subprocess.run(
                [
                    "python3",
                    str(PROJECT_ROOT / "scripts" / "stage_archive.py"),
                    str(posts),
                    str(destination),
                ],
                check=True,
                capture_output=True,
                text=True,
            )

            self.assertEqual(
                (destination / "fixture.md").read_text(encoding="utf-8"),
                (posts / "fixture.md").read_text(encoding="utf-8"),
            )


@unittest.skipUnless(shutil.which("bundle"), "Ruby Bundler is required for the Jekyll build")
class PagesArtifactTests(unittest.TestCase):
    def test_fixture_archive_builds_browsable_pages_with_provenance(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            (source / "_layouts").mkdir(parents=True)
            archive_posts = source / "archive-source" / "posts"
            archive_posts.mkdir(parents=True)
            shutil.copy(PROJECT_ROOT / "_config.yml", source / "_config.yml")
            shutil.copy(PROJECT_ROOT / "index.md", source / "index.md")
            shutil.copytree(PROJECT_ROOT / "_layouts", source / "_layouts", dirs_exist_ok=True)
            shutil.copytree(PROJECT_ROOT / "_includes", source / "_includes", dirs_exist_ok=True)
            shutil.copytree(PROJECT_ROOT / "_plugins", source / "_plugins", dirs_exist_ok=True)
            shutil.copytree(PROJECT_ROOT / "scripts", source / "scripts", dirs_exist_ok=True)
            (archive_posts / "available-date.md").write_text(
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
            (archive_posts / "no-date.md").write_text(
                """---
source_url: https://github.blog/changelog/copilot-no-date/
fetched_at: 2026-10-01T01:01:00+00:00
---

No publication time was available.
""",
                encoding="utf-8",
            )

            subprocess.run(
                [
                    "python3",
                    str(source / "scripts" / "stage_archive.py"),
                    str(archive_posts),
                    str(source / "_archive"),
                ],
                check=True,
                capture_output=True,
                text=True,
            )

            destination = root / "_site"
            build_result = subprocess.run(
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
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(build_result.returncode, 0, build_result.stdout + build_result.stderr)

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
            self.assertIn("2026-09-29 12:30:00 +0000", article)
            self.assertIn("2026-10-01 01:00:00 +0000", article)
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
