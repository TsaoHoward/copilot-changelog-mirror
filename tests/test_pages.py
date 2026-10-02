import os
import shutil
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path

from bs4 import BeautifulSoup

from copilot_mirror import FeedPost, archive_document_from_html

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
    def test_schedule_and_manual_trigger_capture_without_parsing_or_publishing(self):
        lines = ORCHESTRATION_WORKFLOW.read_text(encoding="utf-8").splitlines()
        triggers = yaml_block(lines, "on:", 0)
        schedule = yaml_block(triggers, "schedule:", 2)
        root_permissions = yaml_block(lines, "permissions:", 0)
        jobs = yaml_block(lines, "jobs:", 0)
        capture = yaml_block(jobs, "capture:", 2)
        capture_permissions = yaml_block(capture, "permissions:", 4)
        capture_steps = yaml_block(capture, "steps:", 4)
        capture_step_blocks = ["\n".join(block) for block in list_item_blocks(capture_steps, 6)]
        archive_fetch_step = next(
            block for block in capture_step_blocks if "Fetch existing archive history" in block
        )
        capture_commands = [
            line.strip().removeprefix("run: ")
            for block in capture_step_blocks
            for line in block.splitlines()
            if line.strip().startswith("run: ")
        ]
        schedule_config = [line.strip().removeprefix("- ") for line in schedule]
        trigger_config = [line.strip() for line in triggers]
        capture_permission_config = [line.strip() for line in capture_permissions]

        self.assertEqual(
            [line for line in schedule_config if line.startswith("cron:")],
            ['cron: "17 6,12 * * *"'],
        )
        self.assertIn('timezone: "Asia/Taipei"', schedule_config)
        self.assertIn("workflow_dispatch:", trigger_config)
        self.assertNotIn("contents: write", [line.strip() for line in root_permissions])
        self.assertEqual(capture_permission_config, ["permissions:", "contents: write"])
        job_names = [
            line.strip() for line in jobs if line.startswith("  ") and not line.startswith("    ")
        ]
        self.assertEqual(
            job_names,
            ["capture:"],
        )
        self.assertNotIn("publish-pages", "\n".join(lines))
        capture_command = "python3 src/copilot_mirror.py capture"
        self.assertEqual(capture_commands.count(capture_command), 1)
        self.assertNotIn("uv run copilot-mirror", "\n".join(lines))
        self.assertNotIn("uv sync --locked", "\n".join(lines))
        self.assertNotIn("setup-uv", "\n".join(lines))
        push_command = "git push origin mirror-data"
        self.assertIn(
            "git ls-remote --exit-code --heads origin refs/heads/mirror-data",
            archive_fetch_step,
        )
        self.assertIn('[ "$status" -eq 2 ]', archive_fetch_step)
        self.assertIn('exit "$status"', archive_fetch_step)
        self.assertIn(
            "git fetch origin mirror-data:refs/remotes/origin/mirror-data",
            archive_fetch_step,
        )
        self.assertLess(
            capture_step_blocks.index(archive_fetch_step),
            next(
                index for index, block in enumerate(capture_step_blocks) if capture_command in block
            ),
        )
        self.assertLess(
            capture_commands.index(capture_command), capture_commands.index(push_command)
        )

    def test_archive_history_fetch_bootstraps_without_hiding_remote_errors(self):
        lines = ORCHESTRATION_WORKFLOW.read_text(encoding="utf-8").splitlines()
        jobs = yaml_block(lines, "jobs:", 0)
        capture = yaml_block(jobs, "capture:", 2)
        capture_steps = yaml_block(capture, "steps:", 4)
        fetch_step = next(
            "\n".join(block)
            for block in list_item_blocks(capture_steps, 6)
            if "Fetch existing archive history" in "\n".join(block)
        )
        fetch_script = textwrap.dedent(fetch_step.split("run: |", 1)[1])

        with tempfile.TemporaryDirectory() as temp_dir:
            fake_git = Path(temp_dir) / "git"
            for lookup_status, fetch_status, expected_status, should_fetch in (
                (0, 0, 0, True),
                (2, 0, 0, False),
                (128, 0, 128, False),
                (0, 128, 128, True),
            ):
                fake_git.write_text(
                    "#!/bin/sh\n"
                    f'if [ "$1" = "ls-remote" ]; then exit {lookup_status}; fi\n'
                    f'if [ "$1" = "fetch" ]; then printf "fetched\\n"; exit {fetch_status}; fi\n'
                    "exit 99\n",
                    encoding="utf-8",
                )
                fake_git.chmod(0o755)
                result = subprocess.run(
                    ["bash", "-e", "-o", "pipefail", "-c", fetch_script],
                    env={**os.environ, "PATH": f"{temp_dir}:/usr/bin:/bin"},
                    check=False,
                    capture_output=True,
                    text=True,
                )

                self.assertEqual(result.returncode, expected_status)
                self.assertEqual("fetched" in result.stdout, should_fetch)

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
title: Fixture update
source_url: https://github.blog/changelog/copilot-fixture/
published_at: 2026-09-29T12:30:00+00:00
fetched_at: 2026-10-01T01:00:00+00:00
---

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

    def test_normalized_source_fixture_builds_with_one_title_and_working_fragments(self):
        root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, root, ignore_errors=True)
        source = root / "source"
        (source / "_layouts").mkdir(parents=True)
        archive_posts = source / "archive-source" / "posts"
        archive_posts.mkdir(parents=True)
        for name in ("_config.yml", "index.md"):
            shutil.copy(PROJECT_ROOT / name, source / name)
        for name in ("_layouts", "_includes", "_plugins", "scripts"):
            shutil.copytree(PROJECT_ROOT / name, source / name, dirs_exist_ok=True)

        fixture = PROJECT_ROOT / "tests" / "fixtures" / "github_changelog_article.html"
        post = FeedPost(
            title="Discovery title from the Copilot feed",
            url="https://github.blog/changelog/copilot-debugging-fixture/",
            published_at="2026-10-01T12:30:00+00:00",
        )
        document = archive_document_from_html(
            post, fixture.read_bytes(), "2026-10-02T00:00:00+00:00"
        )
        self.assertIn('title: "Improved debugging with Copilot Chat"', document)
        archived_path = archive_posts / "copilot-debugging-fixture.md"
        archived_path.write_text(document, encoding="utf-8")

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

        listing = BeautifulSoup(
            (destination / "index.html").read_text(encoding="utf-8"), "html.parser"
        )
        article_html = (
            destination / "posts" / "copilot-debugging-fixture" / "index.html"
        ).read_text(encoding="utf-8")
        article_document = BeautifulSoup(article_html, "html.parser")
        post_element = article_document.select_one("article")
        self.assertIsNotNone(post_element)
        self.assertEqual(
            [heading.get_text(" ", strip=True) for heading in post_element.find_all("h1")],
            ["Improved debugging with Copilot Chat"],
        )
        listing_titles = [link.get_text(" ", strip=True) for link in listing.find_all("a")]
        self.assertIn("Improved debugging with Copilot Chat", listing_titles)

        content = post_element.select_one(".article-content")
        self.assertIsNotNone(content)
        self.assertEqual(content.find_all("h1"), [])
        self.assertEqual(
            [heading.get_text(" ", strip=True) for heading in content.find_all("h2")].count(
                "Table of Contents"
            ),
            1,
        )
        page_text = content.get_text(" ", strip=True)
        for chrome in ("Copied", "Shared", "Back to changelog", "Menu. Currently selected"):
            self.assertNotIn(chrome, page_text)

        heading_ids = {
            heading.get("id")
            for heading in content.find_all(["h2", "h3", "h4", "h5", "h6"])
            if heading.get("id")
        }
        heading_ids_by_text = {
            heading.get_text(" ", strip=True): heading.get("id")
            for heading in content.find_all(["h2", "h3", "h4", "h5", "h6"])
            if heading.get("id")
        }
        fragment_links = [
            link for link in content.find_all("a", href=True) if link["href"].startswith("#")
        ]
        expected_targets = {
            "What changed?": "What changed?",
            "🚀 Try it out + share feedback": "🚀 Try it out + share feedback",
            "What changed again?": "What changed?",
        }
        self.assertEqual(len(fragment_links), len(expected_targets))
        for link in fragment_links:
            self.assertIn(link["href"][1:], heading_ids)
            label = link.get_text(" ", strip=True)
            self.assertEqual(link["href"], f"#{heading_ids_by_text[expected_targets[label]]}")
        self.assertNotIn("source-whats-changed-v2", heading_ids)
        self.assertNotIn("🚀-try-it-out---feedback", heading_ids)

        self.assertIsNotNone(content.find("strong", string="clearer debugging steps"))
        self.assertIsNotNone(
            content.find("a", href="https://docs.example.test/debugging#reference")
        )
        self.assertEqual(
            [item.get_text(strip=True) for item in content.find_all("li")][-2:],
            [
                "Explain the failed operation.",
                "Point to the likely source of the invalid state.",
            ],
        )
        self.assertIsNotNone(content.find("img", alt="Debug trace screenshot"))
        self.assertIsNotNone(
            content.find("code", string=lambda text: text and "first_frame" in text)
        )


if __name__ == "__main__":
    unittest.main()
