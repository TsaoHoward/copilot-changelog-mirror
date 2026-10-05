"""Acceptance tests at the durable production stage boundary."""

import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

from archive_support import PROJECT_ROOT, git, initialize_repository

sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
from production_stage import (
    ActionsEvidence,
    check_fresh,
    new_result,
    prepare_deployment,
    prepare_publication,
    record_publication,
    run_writer,
    select_result,
    validate_handoff,
)


class HostedEvidenceFixture:
    """Stub the hosted HTTP boundary; exercise the production API client unchanged."""

    def __init__(self):
        self.responses = {}
        self.requests = []
        fixture = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                fixture.requests.append(self.path)
                path = self.path.split("?", 1)[0]
                value = fixture.responses.get(path)
                self.send_response(200 if value is not None else 404)
                self.end_headers()
                self.wfile.write(value if isinstance(value, bytes) else json.dumps(value).encode())

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.client = ActionsEvidence(
            "owner/archive", "fixture-token", f"http://127.0.0.1:{self.server.server_port}"
        )

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def store(self, record, *, conclusion="success", event="workflow_dispatch"):
        stage, run_id, attempt = record["stage"], record["run_id"], record["attempt"]
        filename = {
            "capture": "mirror-and-publish.yml",
            "render": "render-posts.yml",
            "publish": "publish-pages.yml",
        }[stage]
        run = {
            "id": run_id,
            "run_attempt": attempt,
            "head_sha": record["definition_sha"],
            "head_branch": "main",
            "repository": {"full_name": "owner/archive"},
            "head_repository": {"full_name": "owner/archive"},
            "event": event,
            "path": ".github/workflows/" + filename,
            "conclusion": conclusion,
        }
        prefix = "/repos/owner/archive"
        self.responses[f"{prefix}/actions/runs/{run_id}/attempts/{attempt}"] = run
        artifact_id = run_id * 10 + attempt
        artifacts_path = f"{prefix}/actions/runs/{run_id}/artifacts"
        artifacts = self.responses.setdefault(artifacts_path, {"artifacts": []})["artifacts"]
        artifacts.append(
            {
                "id": artifact_id,
                "name": f"stage-{stage}-{run_id}-{attempt}",
                "expired": False,
                "workflow_run": {"id": run_id},
            }
        )
        data = io.BytesIO()
        with zipfile.ZipFile(data, "w") as archive:
            archive.writestr("stage.json", json.dumps(record))
        self.responses[f"{prefix}/actions/artifacts/{artifact_id}/zip"] = data.getvalue()
        runs = self.responses.setdefault(
            f"{prefix}/actions/workflows/{filename}/runs", {"workflow_runs": []}
        )["workflow_runs"]
        runs.insert(0, run)
        return run


class ProductionStageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo"
        initialize_repository(self.repo)
        (self.repo / "src").mkdir()
        (self.repo / "src/copilot_mirror.py").write_bytes(
            (PROJECT_ROOT / "src/copilot_mirror.py").read_bytes()
        )
        for name in ("_config.yml", "index.md", "Gemfile", "Gemfile.lock"):
            shutil.copy(PROJECT_ROOT / name, self.repo / name)
        for name in ("_layouts", "_includes", "_plugins"):
            shutil.copytree(PROJECT_ROOT / name, self.repo / name)
        (self.repo / "scripts").mkdir()
        shutil.copy(PROJECT_ROOT / "scripts/stage_archive.py", self.repo / "scripts")
        git(self.repo, "add", ".")
        git(self.repo, "commit", "-qm", "Fixture application")
        self.application = git(self.repo, "rev-parse", "HEAD").decode().strip()
        self.remote = self.root / "remote.git"
        subprocess.run(["git", "init", "--bare", "-q", str(self.remote)], check=True)
        git(self.repo, "remote", "add", "origin", str(self.remote))
        git(self.repo, "push", "origin", "main")
        self.article = self.root / "article.html"
        self.article.write_text("<article><h1>Fixture article</h1><p>Saved bytes.</p></article>")
        self.feed = self.root / "feed.xml"
        self.feed.write_text(
            f"<rss><channel><item><title>Fixture</title><link>{self.article.as_uri()}</link>"
            "</item></channel></rss>"
        )
        self.hosted = HostedEvidenceFixture()
        self.addCleanup(self.hosted.close)

    def result(self, stage, archive=None, advance=True):
        return new_result(
            stage,
            "owner/archive",
            "main",
            101 if stage == "capture" else 102,
            1,
            git(self.repo, "rev-parse", "HEAD").decode().strip(),
            self.application,
            advance,
            archive,
        )

    def head(self):
        return git(self.remote, "rev-parse", "refs/heads/mirror-data").decode().strip()

    def render(self):
        captured = self.result("capture")
        run_writer(self.repo, captured, feed_url=self.feed.as_uri())
        rendered = self.result("render", self.head())
        run_writer(self.repo, rendered)
        return rendered

    def publication(self, rendered):
        result = self.result("publish", rendered["archive_output"])
        result["selected_render"] = rendered
        return result

    def env(self, event="workflow_dispatch"):
        return {
            "GITHUB_REPOSITORY": "owner/archive",
            "GITHUB_REF": "refs/heads/main",
            "GITHUB_SHA": self.application,
            "GITHUB_RUN_ID": "104",
            "GITHUB_RUN_ATTEMPT": "1",
            "GITHUB_EVENT_NAME": event,
        }

    def event(self, **values):
        return {"repository": {"full_name": "owner/archive", "default_branch": "main"}, **values}

    def clone(self, name):
        clone = self.root / name
        subprocess.run(
            ["git", "clone", "-q", "--branch", "main", str(self.remote), str(clone)],
            check=True,
            capture_output=True,
        )
        git(clone, "config", "user.name", "Fixture User")
        git(clone, "config", "user.email", "fixture@example.invalid")
        return clone

    def test_manual_modes_and_exact_attempt_auto_selection(self):
        selected = select_result("capture", self.event(), self.env(), self.repo, self.hosted.client)
        self.assertTrue(selected["advance"])
        selected_only = select_result(
            "capture",
            self.event(inputs={"advance": "false"}),
            self.env(),
            self.repo,
            self.hosted.client,
        )
        self.assertFalse(selected_only["advance"])
        run_writer(self.repo, selected_only, feed_url=self.feed.as_uri())
        run = self.hosted.store(selected_only)
        downstream = select_result(
            "render",
            self.event(workflow_run=run),
            self.env("workflow_run"),
            self.repo,
            self.hosted.client,
        )
        self.assertEqual(downstream["outcome"], "stage-only")
        self.assertFalse(downstream["eligible"])
        rendered = select_result("render", self.event(), self.env(), self.repo, self.hosted.client)
        self.assertFalse(rendered["advance"])
        run_writer(self.repo, rendered)
        self.hosted.store(rendered)
        manual_publish = select_result(
            "publish", self.event(), self.env(), self.repo, self.hosted.client
        )
        self.assertEqual(manual_publish["archive_input"], self.head())
        self.assertEqual(manual_publish["upstream"]["run_id"], 104)
        advancing = select_result(
            "render",
            self.event(inputs={"advance": "true"}),
            self.env(),
            self.repo,
            self.hosted.client,
        )
        self.assertTrue(advancing["advance"])
        # Another attempt of the same capture run cannot replace attempt one's evidence.
        captured = self.result("capture")
        run_writer(self.repo, captured, feed_url=self.feed.as_uri())
        run = self.hosted.store(captured)
        self.hosted.store({**captured, "attempt": 2, "archive_output": "f" * 40})
        downstream = select_result(
            "render",
            self.event(workflow_run=run),
            self.env("workflow_run"),
            self.repo,
            self.hosted.client,
        )
        self.assertEqual(downstream["archive_input"], captured["archive_output"])
        self.assertEqual(downstream["upstream"]["attempt"], 1)

    def test_missing_expired_malformed_wrong_attempt_evidence_never_falls_back(self):
        captured = self.result("capture")
        run_writer(self.repo, captured, feed_url=self.feed.as_uri())
        run = self.hosted.store(captured)
        prefix = "/repos/owner/archive"
        artifact_path = f"{prefix}/actions/runs/101/artifacts"
        zip_path = f"{prefix}/actions/artifacts/1011/zip"
        original = self.hosted.responses[artifact_path]
        for listing in (
            {"artifacts": []},
            {"artifacts": [{**original["artifacts"][0], "expired": True}]},
            {"artifacts": [{**original["artifacts"][0], "name": "stage-capture-101-2"}]},
        ):
            with self.subTest(listing=listing):
                self.hosted.responses[artifact_path] = listing
                with self.assertRaisesRegex(ValueError, "evidence"):
                    select_result(
                        "render",
                        self.event(workflow_run=run),
                        self.env("workflow_run"),
                        self.repo,
                        self.hosted.client,
                    )
        self.hosted.responses[artifact_path] = original
        self.hosted.responses[zip_path] = b"malformed zip"
        with self.assertRaises(zipfile.BadZipFile):
            self.hosted.client.handoff(101, 1, "capture", "main")
        self.assertEqual(self.head(), captured["archive_output"])

    def test_acquisition_and_push_failure_never_offer_handoff(self):
        acquisition = self.result("capture")
        with self.assertRaises(subprocess.CalledProcessError):
            run_writer(self.repo, acquisition, feed_url=(self.root / "missing.xml").as_uri())
        self.assertEqual(acquisition["outcome"], "failure")
        self.assertFalse(acquisition["eligible"])
        hook = self.remote / "hooks/pre-receive"
        hook.write_text("#!/bin/sh\nexit 1\n")
        hook.chmod(0o755)
        rejected = self.result("capture")
        with self.assertRaises(subprocess.CalledProcessError):
            run_writer(self.repo, rejected, feed_url=self.feed.as_uri())
        self.assertFalse(rejected["eligible"])
        self.assertIsNone(rejected["archive_output"])
        self.assertEqual(
            git(self.remote, "for-each-ref", "--format=%(refname)"), b"refs/heads/main\n"
        )

    def test_failed_render_recovers_from_unchanged_capture_without_losing_saved_bytes(self):
        captured = self.result("capture")
        run_writer(self.repo, captured, feed_url=self.feed.as_uri())
        saved = git(self.remote, "ls-tree", "-r", captured["archive_output"])
        guard = self.root / "dependency-failure"
        guard.mkdir()
        (guard / "markdownify.py").write_text("raise RuntimeError('Injected render failure')")
        failed = self.result("render", self.head())
        with patch.dict(os.environ, {"PYTHONPATH": str(guard)}):
            with self.assertRaises(subprocess.CalledProcessError):
                run_writer(self.repo, failed)
        self.assertFalse(failed["eligible"])
        self.assertEqual(self.head(), captured["archive_output"])
        self.assertEqual(git(self.remote, "ls-tree", "-r", self.head()), saved)
        recovered_capture = self.result("capture")
        run_writer(self.repo, recovered_capture, feed_url=self.feed.as_uri())
        self.assertTrue(recovered_capture["eligible"])
        self.assertEqual(recovered_capture["outcome"], "no-change")
        repaired = self.result("render", self.head())
        run_writer(self.repo, repaired)
        self.assertTrue(repaired["eligible"])

    def test_render_push_failure_preserves_remote_capture_and_retry_uses_fresh_checkout(self):
        captured = self.result("capture")
        run_writer(self.repo, captured, feed_url=self.feed.as_uri())
        hook = self.remote / "hooks/pre-receive"
        hook.write_text("#!/bin/sh\nexit 1\n")
        hook.chmod(0o755)
        failed = self.result("render", self.head())
        with self.assertRaises(subprocess.CalledProcessError):
            run_writer(self.repo, failed)
        self.assertFalse(failed["eligible"])
        self.assertEqual(self.head(), captured["archive_output"])
        hook.unlink()
        repaired = self.result("render", self.head())
        run_writer(self.clone("repair"), repaired)
        self.assertTrue(repaired["eligible"])

    def test_out_of_band_push_during_render_supersedes_local_derivation(self):
        from copilot_mirror import write_data_branch

        captured = self.result("capture")
        run_writer(self.repo, captured, feed_url=self.feed.as_uri())
        external = self.clone("external")
        write_data_branch(
            external,
            "mirror-data",
            {"operator-note.txt": b"Concurrent update"},
            "External ordinary update",
        )
        external_sha = git(external, "rev-parse", "mirror-data").decode().strip()
        hook = self.repo / ".git/hooks/post-commit"
        hook.write_text(
            "#!/bin/sh\nunset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR\n"
            f"git -C '{external}' push origin mirror-data\n"
        )
        hook.chmod(0o755)
        stale = self.result("render", self.head())
        run_writer(self.repo, stale)
        self.assertEqual(stale["outcome"], "superseded")
        self.assertFalse(stale["eligible"])
        self.assertEqual(self.head(), external_sha)
        self.assertEqual(
            git(self.remote, "rev-parse", "mirror-data^").decode().strip(),
            captured["archive_output"],
        )

    def test_old_render_requests_cannot_write_after_newer_capture(self):
        captured = self.result("capture")
        run_writer(self.repo, captured, feed_url=self.feed.as_uri())
        stale = self.result("render", self.head())
        self.article.write_text("<article><h1>New input</h1><p>Current body.</p></article>")
        newer = self.result("capture")
        run_writer(self.repo, newer, feed_url=self.feed.as_uri())
        run_writer(self.repo, stale)
        self.assertEqual(stale["outcome"], "superseded")
        self.assertEqual(self.head(), newer["archive_output"])
        current = self.result("render", self.head())
        run_writer(self.repo, current)
        self.assertTrue(current["eligible"])

    def build(self, result, *, broken=False):
        archive = self.repo / "archive-source/posts"
        archive.mkdir(parents=True, exist_ok=True)
        revision = result["rendered_revision"]
        for path in (
            git(self.repo, "ls-tree", "-r", "--name-only", revision, "posts").decode().splitlines()
        ):
            (archive / Path(path).name).write_bytes(git(self.repo, "show", f"{revision}:{path}"))
        subprocess.run(
            [
                sys.executable,
                str(self.repo / "scripts/stage_archive.py"),
                str(archive),
                str(self.repo / "_archive"),
            ],
            check=True,
            capture_output=True,
        )
        if broken:
            (self.repo / "_layouts/post.html").write_text("{% deliberately_invalid %}")
        return subprocess.run(
            [
                "bundle",
                "exec",
                "jekyll",
                "build",
                "--source",
                str(self.repo),
                "--destination",
                str(self.root / "site"),
                "--baseurl",
                result["baseurl"],
            ],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
        )

    def test_full_chain_build_failure_publish_retry_and_unchanged_duplicate(self):
        rendered = self.render()
        persisted = self.head()
        publication = self.publication(rendered)
        prepare_publication(self.repo, publication)
        valid_layout = (self.repo / "_layouts/post.html").read_text()
        failed_build = self.build(publication, broken=True)
        self.assertNotEqual(failed_build.returncode, 0)
        self.assertNotIn("deployment", publication)
        (self.repo / "_layouts/post.html").write_text(valid_layout)
        built = self.build(publication)
        self.assertEqual(built.returncode, 0, built.stdout + built.stderr)
        page = (self.root / "site/posts/article/index.html").read_text()
        self.assertIn("Saved bytes.", page)
        # The hosted deployment stub uses the same success-recording boundary as the workflow.
        with self.assertRaisesRegex(ValueError, "successful publication"):
            record_publication(publication, "failure", 501, 601, "https://owner.github.io/archive/")
        self.assertNotIn("deployment", publication)
        self.assertEqual(self.head(), persisted)
        self.article.unlink()  # Publish-only recovery cannot refetch or render.
        retry = self.publication(rendered)
        prepare_publication(self.repo, retry)
        self.assertTrue(retry["deploy"])
        record_publication(retry, "success", 501, 601, "https://owner.github.io/archive/")
        self.assertEqual(retry["outcome"], "deployed")
        duplicate = self.publication(rendered)
        prepare_publication(self.repo, duplicate, retry)
        self.assertFalse(duplicate["deploy"])
        self.assertEqual(self.head(), persisted)

    def test_snapshot_only_and_excluded_evidence_change_keeps_publication_identity(self):
        from copilot_mirror import write_data_branch

        rendered = self.render()
        published = self.publication(rendered)
        prepare_publication(self.repo, published)
        record_publication(published, "success", 501, 601, "https://owner.github.io/archive/")
        write_data_branch(
            self.repo,
            "mirror-data",
            {"archive-state.json": b"New operational state"},
            "Fixture evidence update",
        )
        git(self.repo, "push", "origin", "mirror-data")
        rerendered = self.result("render", self.head())
        run_writer(self.repo, rerendered)
        self.assertEqual(rerendered["outcome"], "no-change")
        (self.repo / "scripts/operator-evidence.txt").write_text("Unrelated evidence")
        git(self.repo, "add", ".")
        git(self.repo, "commit", "-qm", "Excluded evidence")
        candidate = self.publication(rerendered)
        prepare_publication(self.repo, candidate, published)
        self.assertEqual(candidate["outcome"], "duplicate")

    def test_before_deploy_recheck_detects_new_archive(self):
        rendered = self.render()
        selected = self.publication(rendered)
        prepare_publication(self.repo, selected)
        self.article.write_text("<article><h1>New source</h1><p>New body</p></article>")
        run_writer(self.repo, self.result("capture"), feed_url=self.feed.as_uri())
        self.assertFalse(check_fresh(self.repo, selected, selected["archive_input"]))
        self.assertEqual(selected["outcome"], "superseded")

    def test_verified_publication_baseline_ignores_failed_and_duplicate_runs_and_checks_attempts(
        self,
    ):
        rendered = self.render()
        published = self.publication(rendered)
        published.update(run_id=105, attempt=1)
        prepare_publication(self.repo, published)
        record_publication(published, "success", 501, 601, "https://owner.github.io/archive/")
        self.hosted.store(published)
        prefix = "/repos/owner/archive"
        success_job = {
            "id": 501,
            "name": "deploy",
            "conclusion": "success",
            "steps": [
                {
                    "name": "Deploy Pages artifact",
                    "conclusion": "success",
                    "completed_at": "2026-10-05T01:00:00Z",
                },
                {"name": "Record verified publication", "conclusion": "success"},
            ],
        }
        self.hosted.responses[f"{prefix}/actions/runs/105/attempts/1/jobs"] = {
            "jobs": [success_job]
        }
        self.assertEqual(self.hosted.client.last_publication("main")["deployment"]["job_id"], 501)
        for run_id, outcome in ((106, "failure"), (107, "duplicate")):
            self.hosted.store(
                {**published, "run_id": run_id, "outcome": outcome},
                conclusion="failure" if outcome == "failure" else "success",
            )
            self.hosted.responses[f"{prefix}/actions/runs/{run_id}/attempts/1/jobs"] = {
                "jobs": [
                    {
                        **success_job,
                        "id": run_id * 10,
                        "steps": [
                            {
                                "name": "Deploy Pages artifact",
                                "conclusion": "failure" if outcome == "failure" else "skipped",
                            },
                            {"name": "Record verified publication", "conclusion": "skipped"},
                        ],
                    }
                ]
            }
        self.assertEqual(self.hosted.client.last_publication("main")["run_id"], 105)
        self.hosted.responses[f"{prefix}/actions/runs/105/artifacts"]["artifacts"][0]["expired"] = (
            True
        )
        with self.assertRaisesRegex(ValueError, "expired"):
            self.hosted.client.last_publication("main")

    def test_rerun_of_older_publication_is_baseline_when_it_deployed_last(self):
        rendered = self.render()
        published = self.publication(rendered)
        prepare_publication(self.repo, published)
        prefix = "/repos/owner/archive"
        for run_id, attempt, completed, artifact in (
            (105, 1, "01", 601),
            (106, 1, "02", 602),
            (105, 2, "03", 603),
        ):
            record = {**published, "run_id": run_id, "attempt": attempt}
            record_publication(
                record, "success", artifact - 100, artifact, "https://owner.github.io/archive/"
            )
            self.hosted.store(record)
            self.hosted.responses[f"{prefix}/actions/runs/{run_id}/attempts/{attempt}/jobs"] = {
                "jobs": [
                    {
                        "id": artifact - 100,
                        "name": "deploy",
                        "conclusion": "success",
                        "steps": [
                            {
                                "name": "Deploy Pages artifact",
                                "conclusion": "success",
                                "completed_at": f"2026-10-05T{completed}:00:00Z",
                            },
                            {"name": "Record verified publication", "conclusion": "success"},
                        ],
                    }
                ]
            }
        # GitHub lists each run once with its latest attempt, even when an older run was rerun.
        self.hosted.responses[f"{prefix}/actions/workflows/publish-pages.yml/runs"][
            "workflow_runs"
        ] = [
            self.hosted.responses[f"{prefix}/actions/runs/106/attempts/1"],
            self.hosted.responses[f"{prefix}/actions/runs/105/attempts/2"],
        ]
        baseline = self.hosted.client.last_publication("main")
        self.assertEqual((baseline["run_id"], baseline["attempt"]), (105, 2))

    def test_baseline_absence_allows_adoption_but_api_errors_do_not_mean_absence(self):
        prefix = "/repos/owner/archive"
        path = f"{prefix}/actions/workflows/publish-pages.yml/runs"
        self.hosted.responses[path] = {"workflow_runs": []}
        self.assertIsNone(self.hosted.client.last_publication("main"))
        del self.hosted.responses[path]
        from urllib.error import HTTPError

        with self.assertRaises(HTTPError):
            self.hosted.client.last_publication("main")

    def test_failed_job_rerun_keeps_exact_build_artifact_and_uses_new_attempt_evidence(self):
        rendered = self.render()
        publication = self.publication(rendered)
        prepare_publication(self.repo, publication)
        self.hosted.responses["/repos/owner/archive/actions/workflows/publish-pages.yml/runs"] = {
            "workflow_runs": []
        }
        prepare_deployment(self.repo, publication, self.hosted.client, publication["run_id"], 2)
        self.assertEqual(publication["attempt"], 2)
        self.assertEqual(publication["build_attempt"], 1)
        self.assertTrue(publication["deploy"])
        self.assertEqual(publication["archive_input"], rendered["archive_output"])

    def test_publication_skips_only_verified_same_build_inputs_and_force_keeps_freshness(self):
        rendered = self.render()
        first = self.publication(rendered)
        prepare_publication(self.repo, first)
        self.assertTrue(first["deploy"])
        baseline = {**first, "outcome": "deployed", "run_id": 103, "attempt": 1}
        duplicate = self.publication(rendered)
        prepare_publication(self.repo, duplicate, baseline)
        self.assertEqual(duplicate["outcome"], "duplicate")
        self.assertFalse(duplicate["deploy"])
        forced = self.publication(rendered)
        prepare_publication(self.repo, forced, baseline, force=True)
        self.assertTrue(forced["deploy"])
        # Actual site source changes require publication without any post change.
        (self.repo / "index.md").write_text("A new public archive index")
        git(self.repo, "add", ".")
        git(self.repo, "commit", "-qm", "Site change")
        changed_site = self.publication(rendered)
        changed_site["application_sha"] = git(self.repo, "rev-parse", "HEAD").decode().strip()
        prepare_publication(self.repo, changed_site, baseline)
        self.assertTrue(changed_site["deploy"])
        self.assertNotEqual(changed_site["publication_identity"], first["publication_identity"])
        # A newer capture makes even forced historical publication superseded.
        self.article.write_text("<article><h1>Fixture article</h1><p>New source.</p></article>")
        run_writer(self.repo, self.result("capture"), feed_url=self.feed.as_uri())
        stale = self.publication(rendered)
        prepare_publication(self.repo, stale, baseline, force=True)
        self.assertEqual(stale["outcome"], "superseded")
        self.assertFalse(stale["deploy"])

    def test_handoff_rejects_wrong_identity_attempt_failure_and_unverified_no_change(self):
        record = self.result("capture")
        run_writer(self.repo, record, feed_url=self.feed.as_uri())
        run = {
            "id": 101,
            "run_attempt": 1,
            "head_sha": self.application,
            "head_branch": "main",
            "head_repository": {"full_name": "owner/archive"},
            "repository": {"full_name": "owner/archive"},
            "event": "workflow_dispatch",
            "path": ".github/workflows/mirror-and-publish.yml",
            "conclusion": "success",
        }
        validate_handoff(record, run, "capture", "owner/archive", "main")
        for field, bad in (
            ("run_id", 999),
            ("attempt", 2),
            ("application_sha", "f" * 40),
            ("repository", "attacker/archive"),
            ("branch", "feature"),
            ("outcome", "failure"),
            ("archive_output", None),
            ("changed", "false"),
            ("version", 2),
        ):
            with self.subTest(field=field):
                with self.assertRaises(ValueError):
                    validate_handoff(
                        {**record, field: bad}, run, "capture", "owner/archive", "main"
                    )
        for field, bad in (
            ("conclusion", "cancelled"),
            ("path", ".github/workflows/other.yml"),
            ("head_branch", "feature"),
            ("event", "pull_request"),
        ):
            with self.subTest(field=field):
                with self.assertRaises(ValueError):
                    validate_handoff(
                        record, {**run, field: bad}, "capture", "owner/archive", "main"
                    )
        with self.assertRaises(ValueError):
            validate_handoff(
                {**record, "outcome": "no-change", "changed": False},
                run,
                "capture",
                "owner/archive",
                "main",
            )

    def test_capture_persists_before_offline_render_and_unchanged_replay_keeps_history(self):
        captured = self.result("capture")
        run_writer(self.repo, captured, feed_url=self.feed.as_uri())
        self.assertTrue(captured["eligible"])
        self.assertEqual(captured["archive_output"], self.head())
        captured_sha = self.head()
        paths = git(self.remote, "ls-tree", "-r", "--name-only", captured_sha).decode().splitlines()
        self.assertTrue(all(path.startswith("snapshots/") for path in paths))
        saved = {path: git(self.remote, "show", f"{captured_sha}:{path}") for path in paths}
        # A subprocess audit guard forbids feed/article HTTP access during derivation.
        guard = self.root / "guard"
        guard.mkdir()
        marker = guard / "attempted"
        (guard / "sitecustomize.py").write_text(
            "import sys, os\n"
            "def reject(event, args):\n"
            "    if event in {'socket.connect', 'socket.getaddrinfo', 'urllib.Request'}:\n"
            "        open(os.environ['NETWORK_ATTEMPT'], 'w').write(event)\n"
            "        raise RuntimeError('Source network forbidden')\n"
            "sys.addaudithook(reject)\n"
        )
        rendered = self.result("render", captured_sha)
        previous = os.environ.copy()
        try:
            os.environ.update(PYTHONPATH=str(guard), NETWORK_ATTEMPT=str(marker))
            run_writer(self.repo, rendered)
        finally:
            os.environ.clear()
            os.environ.update(previous)
        self.assertFalse(marker.exists())
        self.assertTrue(rendered["eligible"])
        self.assertEqual(rendered["archive_output"], self.head())
        self.assertEqual(
            git(self.remote, "rev-parse", "mirror-data^").decode().strip(), captured_sha
        )
        for path, content in saved.items():
            self.assertEqual(git(self.remote, "show", f"mirror-data:{path}"), content)
        self.assertIn(b"Saved bytes.", git(self.remote, "show", "mirror-data:posts/article.md"))
        final = self.head()
        recaptured = self.result("capture")
        run_writer(self.repo, recaptured, feed_url=self.feed.as_uri())
        rerendered = self.result("render", recaptured["archive_output"])
        run_writer(self.repo, rerendered)
        self.assertEqual(self.head(), final)
        self.assertEqual(recaptured["outcome"], "no-change")
        self.assertEqual(rerendered["outcome"], "no-change")
        self.assertTrue(rerendered["eligible"])


if __name__ == "__main__":
    unittest.main()
