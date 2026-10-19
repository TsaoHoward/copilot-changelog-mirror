import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { root } from "./support.js";

const load = () =>
  parse(
    readFileSync(join(root, ".github/workflows/update-publish.yml"), "utf8"),
  );

test("installed production chain preserves schedule, source, base, guards and scoped two-job publication", () => {
  const w = load();
  const registered = readdirSync(join(root, ".github/workflows")).map((file) =>
    parse(readFileSync(join(root, ".github/workflows", file), "utf8")),
  );
  const schedules = registered.filter((active) => active.on.schedule);
  assert.deepEqual(
    schedules.map((active) => active.name),
    [w.name],
  );
  assert.deepEqual(w.on.schedule, [
    { cron: "17 6,12 * * *", timezone: "Asia/Taipei" },
  ]);
  assert.deepEqual(w.on.workflow_dispatch.inputs.mode.options, [
    "full-update",
    "render-rebuild",
    "republish",
  ]);
  assert.equal(w.on.workflow_dispatch.inputs.mode.default, "full-update");
  assert.deepEqual(w.concurrency, {
    group: "copilot-archive-production",
    "cancel-in-progress": false,
    queue: "max",
  });
  assert.deepEqual(w.permissions, { contents: "read" });
  assert.deepEqual(Object.keys(w.jobs), ["archive-build", "deploy"]);
  for (const job of Object.values(w.jobs) as any[]) {
    assert.match(
      job.if,
      /github.repository == 'TsaoHoward\/copilot-changelog-mirror'/,
    );
    assert.match(job.if, /github.event.repository.default_branch/);
    assert.match(job.if, /github.event_name == 'schedule'/);
    assert.match(job.if, /github.event_name == 'workflow_dispatch'/);
    assert.equal(job.concurrency, undefined);
  }
  const build = w.jobs["archive-build"];
  assert.equal(
    build.env.FEED_URL,
    "https://github.blog/changelog/label/copilot/feed/",
  );
  assert.equal(build.env.SITE_BASE, "/copilot-changelog-mirror/");
  assert.equal(build.env.SITE_ORIGIN, "https://tsaohoward.github.io");
  assert.deepEqual(build.permissions, { contents: "write" });
  assert.deepEqual(w.jobs.deploy.permissions, {
    pages: "write",
    "id-token": "write",
  });
  assert.equal(w.jobs.deploy.needs, "archive-build");
  assert.equal(w.jobs.deploy.environment.name, "github-pages");
  const upload = build.steps.find((s: any) => s.id === "upload");
  const deploy = w.jobs.deploy.steps.find((s: any) => s.id === "deployment");
  assert.equal(deploy.with.artifact_name, upload.with.name);
  assert.equal(upload.with.path, "${{ runner.temp }}/site");
  assert.equal(build.steps.filter((s: any) => s.run === "npm ci").length, 1);
  assert.ok(
    w.jobs.deploy.steps.every(
      (s: any) =>
        !s.uses?.startsWith("actions/checkout@") && !s.run?.includes("npm"),
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(w),
    /acceptance-source|fixtures|NODE_OPTIONS|workflow_run|stage --|pages --|cutover --|git rebase|--force/,
  );
});

test("production modes gate fixed inputs, independent persistence and finished build before same-run upload", () => {
  const steps = load().jobs["archive-build"].steps;
  const ids = [
    "entry",
    "application",
    "archive",
    "selected",
    "capture",
    "capture-push",
    "render",
    "render-push",
    "build",
    "upload",
  ];
  const positions = ids.map((id) => steps.findIndex((s: any) => s.id === id));
  assert.ok(positions.every((index) => index >= 0));
  assert.deepEqual(
    positions,
    positions.toSorted((a, b) => a - b),
  );
  const byId = (id: string) => steps.find((s: any) => s.id === id);
  for (const id of ["capture", "capture-push"])
    assert.equal(byId(id).if, "steps.entry.outputs.mode == 'full-update'");
  for (const id of ["render", "render-push"])
    assert.equal(byId(id).if, "steps.entry.outputs.mode != 'republish'");
  for (const step of steps.filter((s: any) => ids.includes(s.id))) {
    assert.equal(step["continue-on-error"], undefined);
    assert.doesNotMatch(step.if ?? "", /always|failure|changed/);
  }
  assert.equal(
    byId("application").with.ref,
    "${{ steps.entry.outputs.application }}",
  );
  assert.equal(byId("application").with["persist-credentials"], false);
  assert.equal(steps[0].with.ref, "${{ github.sha }}");
  assert.equal(steps[0].with["persist-credentials"], false);
  assert.equal(byId("archive").with.ref, "mirror-data-v2");
  assert.notEqual(byId("application").with.path, byId("archive").with.path);
  assert.match(byId("selected").run, /merge-base --is-ancestor/);
  assert.match(byId("selected").run, /git checkout --detach/);
  assert.match(byId("selected").run, /git rev-parse HEAD/);
  assert.match(
    byId("selected").run,
    /https:\/\/github.com\/\$GITHUB_REPOSITORY/,
  );
  assert.match(
    byId("capture").run,
    /capture:directory.*--feed-url "\$FEED_URL"/s,
  );
  assert.match(byId("render").run, /render:directory/);
  assert.match(byId("capture-push").run, /persist-stage.sh" capture/);
  assert.match(byId("render-push").run, /persist-stage.sh" render/);
  assert.match(
    byId("build").run,
    /site:build:directory.*--base "\$SITE_BASE" --site "\$SITE_ORIGIN"/s,
  );
});
