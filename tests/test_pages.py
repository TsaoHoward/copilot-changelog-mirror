import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from bs4 import BeautifulSoup

from copilot_mirror import FeedPost, archive_document_from_html

PROJECT_ROOT = Path(__file__).resolve().parents[1]

WORKFLOW = PROJECT_ROOT / ".github" / "workflows" / "publish-pages.yml"
ORCHESTRATION_WORKFLOW = PROJECT_ROOT / ".github" / "workflows" / "mirror-and-publish.yml"
CI_WORKFLOW = PROJECT_ROOT / ".github" / "workflows" / "ci.yml"
RENDER_WORKFLOW = PROJECT_ROOT / ".github" / "workflows" / "render-posts.yml"


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


class ProductionWorkflowContractTests(unittest.TestCase):
    def test_all_stages_share_a_non_cancelling_multi_pending_production_queue(self):
        for workflow in (ORCHESTRATION_WORKFLOW, RENDER_WORKFLOW, WORKFLOW):
            with self.subTest(workflow=workflow.name):
                text = workflow.read_text()
                self.assertIn("group: copilot-archive-production", text)
                self.assertIn("cancel-in-progress: false", text)
                self.assertIn("queue: max", text)
                self.assertIn("github.event.repository.default_branch", text)
                self.assertNotIn("continue-on-error", text)
                self.assertNotIn("--force", text)
                for line in text.splitlines():
                    if "uses:" in line:
                        self.assertRegex(line.split("@", 1)[1].split()[0], r"^[0-9a-f]{40}$")

    def test_capture_cadence_and_manual_mode_keep_acquisition_isolated(self):
        text = ORCHESTRATION_WORKFLOW.read_text()
        self.assertIn('cron: "17 6,12 * * *"', text)
        self.assertIn('timezone: "Asia/Taipei"', text)
        self.assertIn("default: true", text)
        self.assertIn("--stage capture", text)
        self.assertNotIn("uv sync", text)
        self.assertNotIn("jekyll", text)
        self.assertNotIn("pages: write", text)
        self.assertLess(
            text.index("production_stage.py write"), text.index("Save stage handoff evidence")
        )

    def test_successful_completion_handoffs_have_trusted_identity_and_immutable_checkouts(self):
        for workflow, upstream, stage in (
            (RENDER_WORKFLOW, "Capture Copilot Changelog snapshots", "render"),
            (WORKFLOW, "Render archive posts from snapshots", "publish"),
        ):
            with self.subTest(stage=stage):
                text = workflow.read_text()
                self.assertIn("workflows: [" + upstream + "]", text)
                self.assertIn("types: [completed]", text)
                self.assertIn("branches: [main]", text)
                self.assertIn("github.event.workflow_run.conclusion == 'success'", text)
                self.assertIn("github.event.workflow_run.name == '" + upstream + "'", text)
                self.assertIn(
                    "github.event.workflow_run.head_repository.full_name == github.repository", text
                )
                self.assertIn(
                    "github.event.workflow_run.head_branch == github.event.repository.default_branch",
                    text,
                )
                self.assertIn("actions: read", text)
                self.assertNotIn("schedule:", text)
                self.assertNotIn("workflow_call:", text)
                self.assertIn("ref: ${{ steps.selection.outputs.application }}", text)
                self.assertIn("--stage " + stage, text)
                self.assertIn("github.run_attempt", text)
                self.assertNotIn("ref: mirror-data", text)
                self.assertIn("workflow_dispatch:", text)

    def test_render_only_default_uses_locked_offline_derivation(self):
        text = RENDER_WORKFLOW.read_text()
        self.assertIn("default: false", text)
        self.assertIn("uv sync --locked", text)
        self.assertIn("uv run python ../control/scripts/production_stage.py write", text)
        self.assertIn("--definition-repo ../control", text)
        self.assertIn("Render and persist selected snapshots offline", text)
        self.assertNotIn("pages: write", text)
        self.assertNotIn("copilot_mirror.py capture", text)

    def test_publication_build_and_deploy_gate_on_selected_revision_and_freshness(self):
        text = WORKFLOW.read_text()
        build = "\n".join(yaml_block(text.splitlines(), "build:", 2))
        deploy = "\n".join(yaml_block(text.splitlines(), "deploy:", 2))
        self.assertIn("render_run_id:", text)
        self.assertIn("render_attempt:", text)
        self.assertIn("force:", text)
        self.assertIn("ref: ${{ steps.preparation.outputs.archive }}", build)
        self.assertIn("production_stage.py prepare", build)
        self.assertIn("--definition-repo control", build)
        self.assertIn("scripts/stage_archive.py archive-source/posts _archive", build)
        self.assertIn('bundle exec jekyll build --baseurl "$BASEURL"', build)
        self.assertNotIn("contents: write", text)
        self.assertNotIn("production_stage.py write", text)
        self.assertNotIn("pages: write", build)
        self.assertIn("needs: build", deploy)
        self.assertIn("if: needs.build.outputs.deploy == 'true'", deploy)
        self.assertIn("pages: write", deploy)
        self.assertIn("id-token: write", deploy)
        self.assertLess(
            deploy.index("production_stage.py fresh"), deploy.index("Deploy Pages artifact")
        )
        self.assertIn("if: steps.freshness.outputs.deploy == 'true'", deploy)
        self.assertIn("if: steps.deployment.outcome == 'success'", deploy)
        self.assertIn("Record verified publication", deploy)
        self.assertIn("artifact_name: ${{ needs.build.outputs.artifact_name }}", deploy)
        self.assertIn("ATTEMPT: ${{ needs.build.outputs.preparation_attempt }}", deploy)

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
