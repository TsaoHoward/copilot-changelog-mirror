"""Durable production boundaries for the three independent Actions workflows.

Records are run evidence, never archive content. All Git writes use ordinary pushes.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

WORKFLOWS = {
    "capture": "mirror-and-publish.yml",
    "render": "render-posts.yml",
    "publish": "publish-pages.yml",
}
SHA = re.compile(r"[0-9a-f]{40}\Z")


def git(repo: Path, *arguments: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *arguments], check=True, capture_output=True, text=True
    ).stdout.strip()


def remote_head(repo: Path) -> str | None:
    result = subprocess.run(
        [
            "git",
            "-C",
            str(repo),
            "ls-remote",
            "--exit-code",
            "--heads",
            "origin",
            "refs/heads/mirror-data",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode == 2:
        return None
    result.check_returncode()
    return result.stdout.split()[0]


def new_result(
    stage, repository, branch, run_id, attempt, application, definition, advance=False, archive=None
):
    return {
        "version": 1,
        "stage": stage,
        "repository": repository,
        "branch": branch,
        "run_id": int(run_id),
        "attempt": int(attempt),
        "application_sha": application,
        "definition_sha": definition,
        "origin": {"run_id": int(run_id), "attempt": int(attempt)},
        "upstream": None,
        "archive_input": archive,
        "archive_output": None,
        "changed": False,
        "advance": bool(advance),
        "eligible": False,
        "outcome": "pending",
    }


def supersede(result, diagnostic):
    result.update(outcome="superseded", eligible=False, diagnostic=diagnostic)


def check_fresh(repo: Path, result, expected: str | None) -> bool:
    current = remote_head(repo)
    if current != expected:
        supersede(result, f"Archive head {current} supersedes selected revision {expected}")
        return False
    return True


def run_writer(repo: Path, result: dict, feed_url: str | None = None) -> None:
    """Acquire/derive, recheck, push, then declare the remotely verified result eligible."""
    try:
        stage = result["stage"]
        if stage not in {"capture", "render"}:
            raise ValueError("Writer stage must be capture or render")
        if git(repo, "rev-parse", "HEAD") != result["application_sha"]:
            raise ValueError("Writer checkout differs from selected application revision")
        current = remote_head(repo)
        if stage == "capture":
            result["archive_input"] = current
        elif not check_fresh(repo, result, result["archive_input"]):
            return
        if stage == "render" and current is None:
            raise ValueError("No persisted snapshots; run capture first")
        if current:
            git(repo, "fetch", "origin", current)
            local = subprocess.run(
                ["git", "-C", str(repo), "rev-parse", "--verify", "refs/heads/mirror-data"],
                capture_output=True,
                text=True,
            )
            if local.returncode == 0 and local.stdout.strip() != current:
                raise ValueError(
                    "Local archive differs from remote; use a fresh application checkout"
                )
            if local.returncode:
                git(repo, "branch", "mirror-data", current)
        command = [sys.executable, str(repo / "src/copilot_mirror.py"), stage, "--repo", str(repo)]
        if feed_url is not None:
            if stage != "capture":
                raise ValueError("Only capture accepts a feed URL")
            command += ["--feed-url", feed_url]
        subprocess.run(command, check=True)
        output = git(repo, "rev-parse", "refs/heads/mirror-data")
        if not check_fresh(repo, result, current):
            return
        git(repo, "push", "origin", "mirror-data")
        if not check_fresh(repo, result, output):
            return
        result.update(
            archive_output=output,
            changed=output != current,
            eligible=result["advance"],
            outcome="changed" if output != current else "no-change",
        )
        if stage == "render":
            result["rendered_revision"] = output
            result["posts_tree"] = git(repo, "rev-parse", f"{output}:posts")
            result["publication_identity"] = publication_identity(
                repo, output, result["application_sha"], "/" + result["repository"].split("/")[1]
            )
    except Exception as error:
        result.update(outcome="failure", eligible=False, diagnostic=str(error))
        raise


def validate_record(record: dict) -> None:
    if (
        not isinstance(record, dict)
        or type(record.get("version")) is not int
        or record["version"] != 1
    ):
        raise ValueError("Unsupported stage-result schema")
    if record.get("stage") not in WORKFLOWS:
        raise ValueError("Unknown stage")
    for field in ("application_sha", "definition_sha"):
        if not isinstance(record.get(field), str) or not SHA.fullmatch(record[field]):
            raise ValueError(f"Invalid {field}")
    for field in ("archive_input", "archive_output"):
        value = record.get(field)
        if value is not None and (not isinstance(value, str) or not SHA.fullmatch(value)):
            raise ValueError(f"Invalid {field}")
    for field in ("changed", "advance", "eligible"):
        if type(record.get(field)) is not bool:
            raise ValueError(f"Invalid {field}")
    for field in ("run_id", "attempt"):
        if type(record.get(field)) is not int or record[field] < 1:
            raise ValueError(f"Invalid {field}")
    for field in ("origin", "upstream"):
        reference = record.get(field)
        if reference is None and field == "upstream":
            continue
        if not isinstance(reference, dict) or any(
            type(reference.get(key)) is not int or reference[key] < 1
            for key in ("run_id", "attempt")
        ):
            raise ValueError(f"Invalid {field} run reference")
    if record.get("outcome") not in {
        "changed",
        "no-change",
        "deployed",
        "duplicate",
        "superseded",
        "stage-only",
        "failure",
        "pending",
    }:
        raise ValueError("Invalid stage outcome")


def validate_handoff(record, run, stage, repository, branch):
    validate_record(record)
    expected = {
        "stage": stage,
        "repository": repository,
        "branch": branch,
        "run_id": run["id"],
        "attempt": run["run_attempt"],
    }
    if any(record.get(key) != value for key, value in expected.items()):
        raise ValueError("Handoff stage/repository/branch/run/attempt mismatch")
    if (
        run.get("conclusion") != "success"
        or run.get("head_branch") != branch
        or run.get("repository", {}).get("full_name") != repository
        or run.get("head_repository", {}).get("full_name") != repository
        or run.get("path", "").split("@")[0] != f".github/workflows/{WORKFLOWS[stage]}"
        or run.get("event") not in {"schedule", "workflow_dispatch", "workflow_run"}
    ):
        raise ValueError("Upstream execution is not a successful trusted production workflow")
    # workflow_run's head SHA describes the workflow definition, not the selected application.
    if record["definition_sha"] != run["head_sha"]:
        raise ValueError("Handoff definition revision contradicts the upstream run")
    if run["event"] != "workflow_run" and record["application_sha"] != run["head_sha"]:
        raise ValueError("Handoff application revision contradicts the upstream run")
    if stage in {"capture", "render"}:
        if record["outcome"] in {"superseded", "stage-only"} and not record["eligible"]:
            return
        if record["outcome"] not in {"changed", "no-change"} or not record["archive_output"]:
            raise ValueError("Upstream has no remotely persisted successful output")
        changed = record["archive_input"] != record["archive_output"]
        if record["changed"] != changed or (record["outcome"] == "changed") != changed:
            raise ValueError("Contradictory archive change evidence")
        if record["eligible"] != record["advance"]:
            raise ValueError("Contradictory advancement evidence")
        if stage == "render" and (
            record.get("rendered_revision") != record["archive_output"]
            or not SHA.fullmatch(record.get("posts_tree", ""))
        ):
            raise ValueError("Missing or contradictory render evidence")


class ArtifactRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is not None:
            redirected.remove_header("Authorization")
        return redirected


class ActionsEvidence:
    """Read only API adapter. Downloads one bounded JSON member without extracting paths."""

    def __init__(self, repository, token, api_url="https://api.github.com"):
        self.repository = repository
        self.base = f"{api_url}/repos/{repository}"
        self.token = token

    def request(self, path, binary=False):
        request = urllib.request.Request(
            self.base + path,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/vnd.github+json",
            },
        )
        with urllib.request.build_opener(ArtifactRedirect()).open(request, timeout=60) as response:
            content = response.read(2_000_001)
        if len(content) > 2_000_000:
            raise ValueError("Actions evidence exceeds size limit")
        return content if binary else json.loads(content)

    def pages(self, path, key):
        page = 1
        while True:
            separator = "&" if "?" in path else "?"
            values = self.request(f"{path}{separator}per_page=100&page={page}")[key]
            yield from values
            if len(values) < 100:
                return
            page += 1

    def run(self, run_id, attempt):
        if type(run_id) is not int or type(attempt) is not int or min(run_id, attempt) < 1:
            raise ValueError("Run ID and attempt must be positive integers")
        return self.request(f"/actions/runs/{run_id}/attempts/{attempt}")

    def record(self, run, stage, optional=False):
        name = f"stage-{stage}-{run['id']}-{run['run_attempt']}"
        artifacts = [
            item
            for item in self.pages(f"/actions/runs/{run['id']}/artifacts", "artifacts")
            if item["name"] == name
        ]
        if not artifacts and optional:
            return None
        if len(artifacts) != 1 or artifacts[0]["expired"]:
            raise ValueError(
                f"Missing, expired, or ambiguous evidence: {name}; run the stage again"
            )
        artifact = artifacts[0]
        if artifact.get("workflow_run", {}).get("id") != run["id"]:
            raise ValueError("Artifact belongs to a different run")
        payload = self.request(f"/actions/artifacts/{artifact['id']}/zip", binary=True)
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            if (
                archive.namelist() != ["stage.json"]
                or archive.getinfo("stage.json").file_size > 65536
            ):
                raise ValueError("Stage artifact must contain only bounded stage.json")
            return json.loads(archive.read("stage.json"))

    def handoff(self, run_id, attempt, stage, branch):
        run = self.run(run_id, attempt)
        record = self.record(run, stage)
        validate_handoff(record, run, stage, self.repository, branch)
        return record

    def runs(self, stage, branch):
        from urllib.parse import urlencode

        query = urlencode({"branch": branch})
        return self.pages(f"/actions/workflows/{WORKFLOWS[stage]}/runs?{query}", "workflow_runs")

    def current_render(self, revision, branch):
        for run in self.runs("render", branch):
            if run["conclusion"] != "success":
                continue
            record = self.record(run, "render", optional=True)
            if record is None:
                continue  # A run before adoption supplies no current render evidence.
            validate_handoff(record, run, "render", self.repository, branch)
            if record["archive_output"] == revision:
                return record
        raise ValueError("No successful render evidence for current archive; run render-only first")

    def jobs(self, run):
        return list(
            self.pages(f"/actions/runs/{run['id']}/attempts/{run['run_attempt']}/jobs", "jobs")
        )

    def last_publication(self, branch):
        candidates = []
        for listed in self.runs("publish", branch):
            for attempt in range(listed["run_attempt"], 0, -1):
                run = self.run(listed["id"], attempt)
                for job in self.jobs(run):
                    steps = job.get("steps", [])
                    # Earlier workflow versions had no publication identity contract.
                    if not any(step["name"] == "Record verified publication" for step in steps):
                        continue
                    deployed = next(
                        (
                            step
                            for step in steps
                            if step["name"] == "Deploy Pages artifact"
                            and step["conclusion"] == "success"
                        ),
                        None,
                    )
                    if deployed:
                        candidates.append((deployed["completed_at"], run, job))
            # Continue because a rerun of an older run may have deployed more recently.
        if not candidates:
            return None
        _, run, job = max(candidates, key=lambda item: item[0])
        record = self.record(run, "publish")
        if record is None:
            raise ValueError("Latest successful deployment has no publication evidence")
        validate_handoff(record, run, "publish", self.repository, branch)
        deployment = record.get("deployment", {})
        if (
            record["outcome"] != "deployed"
            or job["conclusion"] != "success"
            or deployment.get("job_id") != job["id"]
            or deployment.get("run_id") != run["id"]
            or deployment.get("attempt") != run["run_attempt"]
            or not isinstance(deployment.get("artifact_id"), int)
            or not re.fullmatch(r"[0-9a-f]{64}", record.get("publication_identity", ""))
        ):
            raise ValueError("Latest successful deployment has contradictory publication evidence")
        return record


def publication_identity(repo, archive, application, baseurl):
    """Hash the posts tree and tracked Jekyll/build inputs, never run or snapshot evidence."""
    # Match this repository's Jekyll exclusions. Retain files Jekyll copies as static content.
    excluded = {"README.md", "tests", "scripts", "archive-source"}
    build_files = {
        "Gemfile",
        "Gemfile.lock",
        "scripts/stage_archive.py",
        ".github/workflows/publish-pages.yml",
    }
    tree = git(repo, "ls-tree", "-rz", application).split("\0")
    selected = []
    for entry in tree:
        if not entry:
            continue
        _, path = entry.split("\t", 1)
        root = path.split("/", 1)[0]
        if path in build_files or (root not in excluded and not root.startswith(".")):
            selected.append(entry)
    posts_tree = git(repo, "rev-parse", f"{archive}:posts")
    content = json.dumps(
        {
            "version": 1,
            "posts_tree": posts_tree,
            "site": selected,
            "baseurl": baseurl,
            "ruby": "3.3",
            "build": "bundle exec jekyll build",
        },
        sort_keys=True,
    ).encode()
    return hashlib.sha256(content).hexdigest()


def prepare_publication(repo, result, baseline=None, force=False):
    result["deploy"] = False
    result["force"] = force
    result["build_attempt"] = result["attempt"]
    if not check_fresh(repo, result, result["archive_input"]):
        return
    revision = result["archive_input"]
    selected = result["selected_render"]
    if (
        selected["archive_output"] != revision
        or selected["rendered_revision"] != revision
        or selected["outcome"] not in {"changed", "no-change"}
    ):
        raise ValueError("Publication requires the selected successful rendered revision")
    if git(repo, "rev-parse", "HEAD") != result["application_sha"]:
        raise ValueError("Application checkout differs from selected immutable source")
    git(repo, "fetch", "origin", revision)
    if git(repo, "rev-parse", f"{revision}:posts") != selected["posts_tree"]:
        raise ValueError("Selected render posts tree contradicts persisted archive")
    result["archive_output"] = revision
    result["rendered_revision"] = revision
    result["baseurl"] = "/" + result["repository"].split("/")[1]
    result["publication_identity"] = publication_identity(
        repo, revision, result["application_sha"], result["baseurl"]
    )
    if (
        not force
        and baseline
        and baseline["outcome"] == "deployed"
        and baseline["publication_identity"] == result["publication_identity"]
    ):
        result.update(
            outcome="duplicate",
            baseline={"run_id": baseline["run_id"], "attempt": baseline["attempt"]},
        )
    else:
        result["deploy"] = True


def prepare_deployment(repo, result, evidence, run_id, attempt):
    if result["stage"] != "publish" or result["run_id"] != run_id or result["attempt"] > attempt:
        raise ValueError("Publication preparation belongs to a different run or future attempt")
    result["attempt"] = attempt
    if not check_fresh(repo, result, result["archive_input"]):
        result["deploy"] = False
        return
    if not result.get("force"):
        baseline = evidence.last_publication(result["branch"])
        if baseline and baseline["publication_identity"] == result["publication_identity"]:
            result.update(
                outcome="duplicate",
                deploy=False,
                baseline={"run_id": baseline["run_id"], "attempt": baseline["attempt"]},
            )


def record_publication(result, outcome, job_id, artifact_id, page_url):
    """Accept only the successful hosted deployment boundary, never a build/no-op."""
    if outcome != "success" or not result.get("deploy") or result["outcome"] != "pending":
        raise ValueError("Deployment action did not report an eligible successful publication")
    if job_id < 1 or artifact_id < 1 or not page_url.startswith("https://"):
        raise ValueError("Deployment identity and Pages URL are required")
    result.update(
        outcome="deployed",
        deployment={
            "run_id": result["run_id"],
            "attempt": result["attempt"],
            "job_id": job_id,
            "artifact_id": artifact_id,
            "page_url": page_url,
        },
    )


def select_result(stage, event, env, repo, evidence):
    repository = event["repository"]["full_name"]
    branch = event["repository"]["default_branch"]
    if repository != env["GITHUB_REPOSITORY"] or env["GITHUB_REF"] != f"refs/heads/{branch}":
        raise ValueError("Production execution requires this repository's default branch")
    inputs = event.get("inputs", {})
    advance = stage == "capture"
    if "advance" in inputs:
        advance = inputs["advance"] in (True, "true")
    application = env["GITHUB_SHA"]
    result = new_result(
        stage,
        repository,
        branch,
        int(env["GITHUB_RUN_ID"]),
        int(env["GITHUB_RUN_ATTEMPT"]),
        application,
        env["GITHUB_SHA"],
        advance,
    )
    if env["GITHUB_EVENT_NAME"] == "workflow_run":
        upstream_stage = {"render": "capture", "publish": "render"}[stage]
        upstream = event["workflow_run"]
        # Validate the exact triggering attempt again against server metadata.
        selected = evidence.handoff(upstream["id"], upstream["run_attempt"], upstream_stage, branch)
        if upstream["head_sha"] != selected["definition_sha"]:
            raise ValueError("Completion event contradicts selected run revision")
        result.update(
            upstream={"run_id": selected["run_id"], "attempt": selected["attempt"]},
            origin=selected["origin"],
            application_sha=selected["application_sha"],
            archive_input=selected["archive_output"],
            advance=True,
        )
        if not selected["eligible"]:
            result.update(outcome="stage-only", advance=False)
            return result
        if stage == "publish":
            result["selected_render"] = selected
    elif stage == "render":
        result["archive_input"] = remote_head(repo)
        if result["archive_input"] is None:
            raise ValueError("No persisted snapshots; run capture first")
    elif stage == "publish":
        run_id, attempt = inputs.get("render_run_id", ""), inputs.get("render_attempt", "")
        if bool(run_id) != bool(attempt):
            raise ValueError("Supply both render run ID and attempt, or neither")
        current = remote_head(repo)
        selected = (
            evidence.handoff(int(run_id), int(attempt), "render", branch)
            if run_id
            else evidence.current_render(current, branch)
        )
        result.update(
            selected_render=selected,
            archive_input=selected["archive_output"],
            upstream={"run_id": selected["run_id"], "attempt": selected["attempt"]},
            origin=selected["origin"],
        )
        # Manual publication uses current selected site source, allowing site-only fixes.
    return result


def save_result(path, result):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")


def workflow_outputs(result):
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as output:
            for key, value in {
                "application": result["application_sha"],
                "archive": result.get("archive_output") or result.get("archive_input") or "",
                "proceed": result["outcome"] not in {"stage-only", "superseded", "failure"},
                "deploy": result.get("deploy", False),
                "baseurl": result.get("baseurl", ""),
            }.items():
                if type(value) is bool:
                    value = str(value).lower()
                output.write(f"{key}={value}\n")


def summary(result):
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    url = f"{server}/{result['repository']}"
    lines = [
        f"### {result['stage']}: {result['outcome']}",
        f"Next-stage eligible: `{result['eligible']}`; content changed: `{result['changed']}`.",
    ]
    for key in ("application_sha", "definition_sha", "archive_input", "archive_output"):
        sha = result.get(key)
        lines.append(f"{key}: [{sha}]({url}/commit/{sha})" if sha else f"{key}: absent")
    for label in ("origin", "upstream", "baseline"):
        ref = result.get(label)
        if ref:
            lines.append(
                f"{label}: [run {ref['run_id']}, attempt {ref['attempt']}]"
                f"({url}/actions/runs/{ref['run_id']}/attempts/{ref['attempt']})"
            )
    next_stage = {"capture": "render", "render": "publish", "publish": "publish"}[result["stage"]]
    lines.append(
        f"Downstream/recovery history: [Actions]({url}/actions/workflows/{WORKFLOWS[next_stage]}). "
        "Use a fresh stage-only run if handoff evidence is missing or expired."
    )
    if result.get("publication_identity"):
        lines.append(
            f"Publication inputs: `{result['publication_identity']}`; "
            f"rendered revision: `{result.get('rendered_revision')}`."
        )
    if result.get("deployment"):
        lines.append(f"Verified Pages deployment: {result['deployment']}")
    if result.get("diagnostic"):
        lines.append("Diagnostic: " + result["diagnostic"])
    text = "\n\n".join(lines) + "\n"
    print(text)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as output:
            output.write(text)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "operation", choices=("select", "write", "prepare", "fresh", "published", "report")
    )
    parser.add_argument("--stage", choices=WORKFLOWS)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--repo", type=Path, default=Path("."))
    args = parser.parse_args()
    env = os.environ
    evidence = ActionsEvidence(
        env["GITHUB_REPOSITORY"],
        env.get("GH_TOKEN", ""),
        env.get("GITHUB_API_URL", "https://api.github.com"),
    )
    result = None
    try:
        if args.operation == "select":
            event = json.loads(Path(env["GITHUB_EVENT_PATH"]).read_text())
            result = new_result(
                args.stage,
                env["GITHUB_REPOSITORY"],
                event["repository"]["default_branch"],
                int(env["GITHUB_RUN_ID"]),
                int(env["GITHUB_RUN_ATTEMPT"]),
                env["GITHUB_SHA"],
                env["GITHUB_SHA"],
            )
            result = select_result(args.stage, event, env, args.repo, evidence)
        else:
            result = json.loads(args.state.read_text())
            validate_record(result)
            if args.operation == "write":
                run_writer(args.repo.resolve(), result)
            elif args.operation == "prepare":
                event = json.loads(Path(env["GITHUB_EVENT_PATH"]).read_text())
                force = event.get("inputs", {}).get("force", "false") in (True, "true")
                baseline = None if force else evidence.last_publication(result["branch"])
                prepare_publication(args.repo, result, baseline, force)
            elif args.operation == "fresh":
                prepare_deployment(
                    args.repo,
                    result,
                    evidence,
                    int(env["GITHUB_RUN_ID"]),
                    int(env["GITHUB_RUN_ATTEMPT"]),
                )
            elif args.operation == "published":
                if env.get("DEPLOY_OUTCOME") != "success":
                    raise ValueError("Deployment action did not report success")
                run = {"id": result["run_id"], "run_attempt": result["attempt"]}
                job = next(job for job in evidence.jobs(run) if job["name"] == "deploy")
                record_publication(
                    result,
                    env["DEPLOY_OUTCOME"],
                    job["id"],
                    int(env["PAGES_ARTIFACT_ID"]),
                    env["PAGE_URL"],
                )
            elif args.operation == "report":
                if env.get("STAGE_STATUS") in {"failure", "cancelled"}:
                    result.update(
                        outcome="failure",
                        eligible=False,
                        diagnostic=result.get(
                            "diagnostic", "An Actions step failed; inspect the run log"
                        ),
                    )
                summary(result)
        save_result(args.state, result)
        workflow_outputs(result)
        return 0
    except Exception as error:
        if result is not None:
            result.update(outcome="failure", eligible=False, diagnostic=str(error))
            save_result(args.state, result)
        print(f"Production stage failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
