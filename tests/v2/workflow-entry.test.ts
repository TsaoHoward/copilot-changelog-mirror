import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { root } from "./support.js";

test("production entry shell accepts schedule/manual defaults and rejects unsafe selections before archive credentials", async (t) => {
  const { execFileSync, spawnSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "copilot-entry-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const control = join(dir, "control");
  const remote = join(dir, "remote.git");
  mkdirSync(control);
  const gitEnv = { ...process.env, GIT_ALLOW_PROTOCOL: "file" };
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: control,
      env: gitEnv,
      stdio: "pipe",
    })
      .toString()
      .trim();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Entry fixture");
  git("config", "user.email", "entry@example.invalid");
  // Entry checks compatibility paths and npm script names; it executes no CLI.
  for (const file of [
    "package.json",
    "src/v2/capture-directory-cli.ts",
    "src/v2/render-directory-cli.ts",
    "src/v2/native-site-cli.ts",
  ]) {
    mkdirSync(dirname(join(control, file)), { recursive: true });
    writeFileSync(join(control, file), readFileSync(join(root, file)));
  }
  git("add", ".");
  git("commit", "-qm", "Trusted application commands");
  const trustedApplication = git("rev-parse", "HEAD");
  git("commit", "--allow-empty", "-qm", "Trusted workflow revision");
  const sha = git("rev-parse", "HEAD");
  git("init", "--bare", "-q", "--initial-branch=main", remote);
  git("remote", "add", "origin", remote);
  git("push", "-q", "origin", "main");
  git("fetch", "-q", "origin", "main");
  assert.equal(git("rev-parse", "refs/remotes/origin/main"), sha);
  // This object exists and has all commands, but is outside trusted main history.
  git("switch", "-qc", "untrusted");
  git("commit", "--allow-empty", "-qm", "Untrusted application revision");
  const untrustedApplication = git("rev-parse", "HEAD");
  git("switch", "-q", "main");

  const script = parse(
    readFileSync(join(root, ".github/workflows/update-publish.yml"), "utf8"),
  ).jobs["archive-build"].steps.find((s: any) => s.id === "entry").run;
  const env = {
    ...gitEnv,
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_RUN_ID: "35",
    GITHUB_REPOSITORY: "TsaoHoward/copilot-changelog-mirror",
    GITHUB_REF: "refs/heads/main",
    DEFAULT_BRANCH: "main",
    GITHUB_SHA: sha,
    GITHUB_EVENT_NAME: "workflow_dispatch",
    REQUESTED_MODE: "",
    REQUESTED_APPLICATION: "",
    REQUESTED_ARCHIVE: "",
    GITHUB_OUTPUT: join(dir, "outputs"),
    GITHUB_STEP_SUMMARY: join(dir, "summary"),
  };
  const runEntry = (extra: NodeJS.ProcessEnv) => {
    writeFileSync(env.GITHUB_OUTPUT, "");
    writeFileSync(env.GITHUB_STEP_SUMMARY, "");
    return spawnSync("bash", ["-e", "-o", "pipefail", "-c", script], {
      cwd: control,
      env: { ...env, ...extra },
      encoding: "utf8",
    });
  };
  for (const [extra, mode, application] of [
    [{}, "full-update", sha],
    [{ GITHUB_EVENT_NAME: "schedule" }, "full-update", sha],
    [{ REQUESTED_MODE: "full-update" }, "full-update", sha],
    [{ REQUESTED_MODE: "render-rebuild" }, "render-rebuild", sha],
    [{ REQUESTED_MODE: "republish" }, "republish", sha],
    [{ REQUESTED_MODE: "republish", REQUESTED_ARCHIVE: sha }, "republish", sha],
    [
      { REQUESTED_APPLICATION: trustedApplication },
      "full-update",
      trustedApplication,
    ],
  ] as const) {
    const result = runEntry(extra);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(env.GITHUB_OUTPUT, "utf8"),
      `mode=${mode}\napplication=${application}\n`,
    );
  }
  for (const extra of [
    { GITHUB_REPOSITORY: "untrusted/fork" },
    { GITHUB_REF: "refs/heads/feature" },
    { DEFAULT_BRANCH: "other" },
    { GITHUB_EVENT_NAME: "pull_request" },
    { REQUESTED_MODE: "capture-only" },
    { REQUESTED_ARCHIVE: sha },
    { REQUESTED_APPLICATION: "main" },
    { REQUESTED_APPLICATION: "a".repeat(40) },
    { REQUESTED_APPLICATION: untrustedApplication },
    { GITHUB_SHA: untrustedApplication },
    { REQUESTED_MODE: "republish", REQUESTED_ARCHIVE: "main" },
  ]) {
    const result = runEntry(extra);
    assert.ok(
      result.status !== null && result.status !== 0,
      `${JSON.stringify(extra)}: ${result.stderr}`,
    );
    assert.equal(readFileSync(env.GITHUB_OUTPUT, "utf8"), "");
    assert.equal(readFileSync(env.GITHUB_STEP_SUMMARY, "utf8"), "");
  }
  // This executes the shipped shell using only fixture refs and file transport.
  // It does not simulate Actions schedule registration or expression evaluation.
});
