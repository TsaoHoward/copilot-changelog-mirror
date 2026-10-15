import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { DirectoryFixture } from "./directory-support.js";

test("directory Capture saves bytes without creating a commit; identical capture preserves stored formatting", async (t) => {
  const f = new DirectoryFixture(t);
  const original = f.git("rev-parse", "HEAD");
  const bytes = Buffer.from([60, 112, 62, 255, 0, 13, 10]);
  const source = f.source("article.html", bytes);
  const feed = f.feed(
    `<item><link>${source}</link><title>Feed title</title></item>`,
  );
  const result = await f.cli("capture", ["--feed-url", feed]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.result.outcome, "changed");
  assert.deepEqual(result.result.counts, {
    created: 1,
    updated: 0,
    unchanged: 0,
  });
  assert.equal(f.git("rev-parse", "HEAD"), original);
  const article = Object.values(f.manifest().articles)[0] as any;
  assert.equal(article.canonical, null);
  assert.deepEqual(
    readFileSync(join(f.archive, `snapshots/${article.article_id}.html`)),
    bytes,
  );
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    join(f.archive, "metadata.json"),
    JSON.stringify(f.manifest()) + "\n",
  );
  f.persist("Capture evidence");
  const before = readFileSync(join(f.archive, "metadata.json"));
  const same = await f.cli("capture", ["--feed-url", feed], {
    COPILOT_CAPTURE_NOW: "2026-10-14T00:00:00.000Z",
  });
  assert.equal(same.result.outcome, "no-change", same.stderr);
  assert.deepEqual(readFileSync(join(f.archive, "metadata.json")), before);
  assert.equal(f.git("status", "--porcelain"), "");
});

test("directory Render derives saved evidence offline and repairs missing bodies without changing raw input or Git", async (t) => {
  const f = new DirectoryFixture(t);
  const source = f.source(
    "release.html",
    "<article><h1>Saved title</h1><p>Editorial <strong>content</strong>.</p></article>",
  );
  const feed = f.feed(
    `<item><link>${source}</link><title>Fallback</title></item>`,
  );
  assert.equal((await f.cli("capture", ["--feed-url", feed])).code, 0);
  const captured = f.persist("Capture");
  const raw = readFileSync(join(f.archive, "metadata.json"));
  const rendered = await f.cli("render");
  assert.equal(rendered.code, 0, rendered.stderr);
  assert.deepEqual(rendered.result.counts, {
    rendered: 1,
    updated: 1,
    unchanged: 0,
  });
  assert.equal(f.git("rev-parse", "HEAD"), captured);
  const article = Object.values(f.manifest().articles)[0] as any;
  assert.deepEqual(
    article.capture,
    JSON.parse(raw.toString()).articles[article.article_id].capture,
  );
  assert.equal(article.canonical.title, "Saved title");
  assert.equal(
    readFileSync(join(f.archive, `posts/${article.article_id}.md`), "utf8"),
    "Editorial **content**.\n",
  );
  f.persist("Render");
  assert.equal((await f.cli("render")).result.outcome, "no-change");
  f.git("rm", `posts/${article.article_id}.md`);
  f.git("commit", "-qm", "Remove derived body");
  const repaired = await f.cli("render");
  assert.equal(repaired.result.outcome, "changed", repaired.stderr);
  assert.equal(
    readFileSync(join(f.archive, `posts/${article.article_id}.md`), "utf8"),
    "Editorial **content**.\n",
  );
});

test("ordinary Git pushes Capture before late Render failure, then repaired offline Render descends from Capture", async (t) => {
  const { execFileSync } = await import("node:child_process");
  const { writeFileSync, existsSync } = await import("node:fs");
  const f = new DirectoryFixture(t);
  execFileSync("git", ["init", "--bare", "-q", f.remote]);
  f.git("remote", "add", "origin", f.remote);
  const a = f.source(
    "a-good.html",
    "<article><h1>Good</h1><p>Saved first article.</p></article>",
  );
  const z = f.source(
    "z-new.html",
    '<main class="new-editorial-layout"><h1>New layout</h1><p>Saved second article.</p></main>',
  );
  const feed = f.feed(
    `<item><link>${a}</link></item><item><link>${z}</link></item>`,
  );
  assert.equal((await f.cli("capture", ["--feed-url", feed])).code, 0);
  const persist = (stage: string) => {
    execFileSync(
      "bash",
      [
        join(import.meta.dirname, "../../.github/isolated/persist-stage.sh"),
        stage,
        f.archive,
      ],
      {
        env: {
          ...process.env,
          GITHUB_OUTPUT: join(f.dir, "outputs"),
          GITHUB_STEP_SUMMARY: join(f.dir, "summary"),
        },
        stdio: "pipe",
      },
    );
    return f.git("rev-parse", "HEAD");
  };
  const capture = persist("capture");
  const remote = (...args: string[]) =>
    execFileSync("git", ["--git-dir", f.remote, ...args])
      .toString()
      .trim();
  assert.equal(remote("rev-parse", "mirror-data-v2"), capture);
  const failed = await f.cli("render");
  assert.equal(failed.code, 1);
  assert.match(failed.stderr, /Article z-new-.*Unsupported editorial layout/);
  assert.equal(f.git("status", "--porcelain"), "");
  assert.equal(remote("rev-parse", "mirror-data-v2"), capture);
  for (const article of Object.values(f.manifest().articles) as any[]) {
    assert.equal(
      remote("show", `${capture}:snapshots/${article.article_id}.html`),
      readFileSync(
        join(f.archive, `snapshots/${article.article_id}.html`),
        "utf8",
      ),
    );
    assert.equal(
      existsSync(join(f.archive, `posts/${article.article_id}.md`)),
      false,
    );
  }
  const repair = join(f.dir, "repair-renderer.mjs");
  writeFileSync(
    repair,
    `import { register } from 'node:module'; register(new URL("./repair-loader.mjs",import.meta.url));`,
  );
  writeFileSync(
    join(f.dir, "repair-loader.mjs"),
    `export async function load(url,context,next){const result=await next(url,context);if(url.includes('/src/v2/normalize.ts')){const source=Buffer.from(result.source).toString();return {...result,source:source.replace('".wp-block-changelog-entry__content"','"main.new-editorial-layout", ".wp-block-changelog-entry__content"')};}return result;}`,
  );
  const log = join(f.dir, "network.log");
  const rendered = await f.cli("render", [], { COPILOT_NETWORK_LOG: log }, [
    repair,
    join(import.meta.dirname, "block-network.mjs"),
  ]);
  assert.equal(rendered.code, 0, rendered.stderr);
  assert.equal(existsSync(log), false);
  assert.equal(f.git("rev-parse", "HEAD"), capture);
  const render = persist("render");
  assert.equal(f.git("rev-parse", `${render}^`), capture);
  assert.equal(remote("rev-parse", "mirror-data-v2"), render);
  assert.equal(
    (await f.cli("capture", ["--feed-url", feed])).result.outcome,
    "no-change",
  );
  assert.equal(
    (await f.cli("render", [], {}, [repair])).result.outcome,
    "no-change",
  );
});

test("late Capture failure and new-identity route collisions reject the complete directory batch", async (t) => {
  const { existsSync } = await import("node:fs");
  const f = new DirectoryFixture(t);
  const a = f.source("a.html", "<article><p>Good.</p></article>");
  const missing = new URL("z-missing.html", a).href;
  const feed = f.feed(
    `<item><link>${a}</link></item><item><link>${missing}</link></item>`,
  );
  const before = f.git("rev-parse", "HEAD");
  const failed = await f.cli("capture", ["--feed-url", feed]);
  assert.equal(failed.code, 1);
  assert.equal(existsSync(join(f.archive, "metadata.json")), false);
  assert.equal(f.git("status", "--porcelain"), "");
  assert.equal(f.git("rev-parse", "HEAD"), before);
  const b = f.source(
    "a.htm",
    "<article><p>Another identity, same route.</p></article>",
  );
  const collision = await f.cli("capture", [
    "--feed-url",
    f.feed(`<item><link>${a}</link></item><item><link>${b}</link></item>`),
  ]);
  assert.equal(collision.code, 1);
  assert.match(collision.stderr, /route collision/);
  assert.equal(f.git("status", "--porcelain"), "");
});

test("dirty, wrong, detached, bare, overlapping and symlink targets are refused without changing user work", async (t) => {
  const { writeFileSync, mkdirSync, symlinkSync, rmSync } = await import(
    "node:fs"
  );
  const { execFileSync } = await import("node:child_process");
  const { root } = await import("./support.js");
  const f = new DirectoryFixture(t);
  assert.equal((await f.cli("capture", ["--feed-url", f.feed("")])).code, 0);
  f.persist("Empty manifest");
  const before = f.git("rev-parse", "HEAD");
  writeFileSync(join(f.archive, "metadata.json"), "staged\n");
  f.git("add", "metadata.json");
  writeFileSync(join(f.archive, "metadata.json"), "unstaged\n");
  writeFileSync(join(f.archive, "notes.txt"), "untracked\n");
  const status = f.git("status", "--porcelain");
  const index = f.git("diff", "--cached");
  for (const stage of ["capture", "render"] as const) {
    const failed = await f.cli(stage);
    assert.equal(failed.code, 1);
    assert.match(failed.stderr, /dirty/);
    assert.equal(f.git("status", "--porcelain"), status);
    assert.equal(f.git("diff", "--cached"), index);
    assert.equal(
      readFileSync(join(f.archive, "metadata.json"), "utf8"),
      "unstaged\n",
    );
    assert.equal(
      readFileSync(join(f.archive, "notes.txt"), "utf8"),
      "untracked\n",
    );
    assert.equal(f.git("rev-parse", "HEAD"), before);
  }
  // Restore only disposable fixture files, preserving the actual application checkout.
  f.git("restore", "--staged", "--worktree", "metadata.json");
  rmSync(join(f.archive, "notes.txt"));
  f.git("switch", "-qc", "other");
  assert.match((await f.cli("render")).stderr, /mirror-data-v2/);
  f.git("switch", "-q", "--detach");
  assert.equal((await f.cli("render")).code, 1);
  f.git("switch", "-q", "mirror-data-v2");
  f.git("config", "init.defaultBranch", "mirror-data-v2");
  assert.match((await f.cli("render")).stderr, /default branch/);
  f.git("config", "--unset", "init.defaultBranch");
  mkdirSync(join(f.archive, "posts"));
  assert.match(
    (await f.cli("render", ["--archive-dir", join(f.archive, "posts")])).stderr,
    /checkout root/,
  );
  const link = join(f.dir, "alias");
  symlinkSync(f.archive, link);
  assert.match(
    (await f.cli("render", ["--archive-dir", link])).stderr,
    /symlink/,
  );
  execFileSync("git", ["init", "--bare", "-q", f.remote]);
  assert.match(
    (await f.cli("render", ["--archive-dir", f.remote])).stderr,
    /non-bare/,
  );
  const applicationStatus = execFileSync("git", [
    "-C",
    root,
    "status",
    "--porcelain",
  ]);
  assert.match(
    (await f.cli("render", ["--archive-dir", root])).stderr,
    /overlaps/,
  );
  assert.deepEqual(
    execFileSync("git", ["-C", root, "status", "--porcelain"]),
    applicationStatus,
  );
  assert.equal(f.git("rev-parse", "HEAD"), before);
});

test("inherited Git overrides cannot redirect archive inspection or touch staged application work", async (t) => {
  const { execFileSync } = await import("node:child_process");
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const f = new DirectoryFixture(t);
  const application = join(f.dir, "application");
  mkdirSync(application);
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", application, ...args]).toString();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  writeFileSync(join(application, "app.txt"), "initial\n");
  git("add", ".");
  git("commit", "-qm", "Initial");
  writeFileSync(join(application, "app.txt"), "staged\n");
  git("add", "app.txt");
  writeFileSync(join(application, "app.txt"), "unstaged\n");
  writeFileSync(join(application, "notes.txt"), "untracked\n");
  const before = [
    git("status", "--porcelain"),
    git("diff", "--cached"),
    git("rev-parse", "HEAD"),
  ];
  const env = {
    GIT_DIR: join(application, ".git"),
    GIT_WORK_TREE: application,
    GIT_INDEX_FILE: join(application, ".git/index"),
  };
  const source = f.source("article.html", "<article><p>Body.</p></article>");
  assert.equal(
    (
      await f.cli(
        "capture",
        ["--feed-url", f.feed(`<item><link>${source}</link></item>`)],
        env,
      )
    ).code,
    0,
  );
  f.persist("Capture");
  assert.equal((await f.cli("render", [], env)).code, 0);
  assert.deepEqual(
    [
      git("status", "--porcelain"),
      git("diff", "--cached"),
      git("rev-parse", "HEAD"),
    ],
    before,
  );
  assert.equal(
    readFileSync(join(application, "app.txt"), "utf8"),
    "unstaged\n",
  );
  assert.equal(
    readFileSync(join(application, "notes.txt"), "utf8"),
    "untracked\n",
  );
});

test("a filesystem completion failure reports failure and prevents the caller's commit/push after partial installation", async (t) => {
  const { execFileSync } = await import("node:child_process");
  const { writeFileSync, existsSync } = await import("node:fs");
  const f = new DirectoryFixture(t);
  execFileSync("git", ["init", "--bare", "-q", f.remote]);
  f.git("remote", "add", "origin", f.remote);
  f.git("push", "-q", "origin", "mirror-data-v2");
  const before = f.git("rev-parse", "HEAD");
  const index = f.git("diff", "--cached");
  const guard = join(f.dir, "fail-completion.mjs");
  writeFileSync(
    guard,
    `import fs from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';const rename=fs.rename;fs.rename=async(from,to)=>{if(to.endsWith('/metadata.json'))throw new Error('injected completion failure');return rename(from,to);};syncBuiltinESMExports();`,
  );
  const source = f.source(
    "article.html",
    "<article><p>Saved bytes.</p></article>",
  );
  const result = await f.cli(
    "capture",
    ["--feed-url", f.feed(`<item><link>${source}</link></item>`)],
    {},
    [guard],
  );
  if (result.code === 0) {
    f.persist("Must not persist failed output");
    f.git("push", "origin", "mirror-data-v2");
  }
  assert.equal(result.code, 1);
  assert.equal(result.result.outcome, "failure");
  assert.match(result.stderr, /completion failure/);
  assert.equal(existsSync(join(f.archive, "metadata.json")), false);
  assert.match(f.git("status", "--porcelain"), /snapshots\//);
  assert.equal(f.git("rev-parse", "HEAD"), before);
  assert.equal(f.git("diff", "--cached"), index);
  assert.equal(
    execFileSync("git", ["--git-dir", f.remote, "rev-parse", "mirror-data-v2"])
      .toString()
      .trim(),
    before,
  );
});

test("an ordinary non-fast-forward push preserves the competing writer's history", async (t) => {
  const { execFileSync } = await import("node:child_process");
  const { writeFileSync } = await import("node:fs");
  const f = new DirectoryFixture(t);
  execFileSync("git", ["init", "--bare", "-q", f.remote]);
  f.git("remote", "add", "origin", f.remote);
  f.git("push", "-q", "origin", "mirror-data-v2");
  const competitor = join(f.dir, "competitor");
  execFileSync("git", [
    "clone",
    "-q",
    "-b",
    "mirror-data-v2",
    f.remote,
    competitor,
  ]);
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", competitor, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    })
      .toString()
      .trim();
  git("config", "user.name", "Competitor");
  git("config", "user.email", "competitor@example.invalid");
  writeFileSync(
    join(competitor, "metadata.json"),
    '{"schema_version":2,"articles":{}}\n',
  );
  git("add", ".");
  git("commit", "-qm", "Competing update");
  git("push", "-q");
  const competing = git("rev-parse", "HEAD");
  assert.equal((await f.cli("capture", ["--feed-url", f.feed("")])).code, 0);
  const local = f.persist("Local Capture");
  assert.throws(
    () => f.git("push", "origin", "mirror-data-v2"),
    /rejected|fetch first|non-fast-forward/,
  );
  assert.equal(f.git("rev-parse", "HEAD"), local);
  assert.equal(
    execFileSync("git", ["--git-dir", f.remote, "rev-parse", "mirror-data-v2"])
      .toString()
      .trim(),
    competing,
  );
});

test("Capture starts with renderer unavailable; Render runs with acquisition unavailable and guards record caught attempts", async (t) => {
  const { execFileSync } = await import("node:child_process");
  const { existsSync } = await import("node:fs");
  const f = new DirectoryFixture(t);
  const guard = join(import.meta.dirname, "directory-isolation.mjs");
  const network = join(import.meta.dirname, "block-network.mjs");
  const isolationLog = join(f.dir, "isolation.log"),
    networkLog = join(f.dir, "network.log");
  const source = f.source(
    "article.html",
    "<article><h1>Offline</h1><p>Saved <img src='https://example.invalid/image.png' alt='Meaningful'> content.</p></article>",
  );
  const captured = await f.cli(
    "capture",
    ["--feed-url", f.feed(`<item><link>${source}</link></item>`)],
    { COPILOT_ISOLATION_MODE: "capture", COPILOT_ISOLATION_LOG: isolationLog },
    [guard],
  );
  assert.equal(captured.code, 0, captured.stderr);
  assert.equal(existsSync(isolationLog), false);
  f.persist("Capture");
  const { rmSync } = await import("node:fs");
  rmSync(new URL(source));
  rmSync(join(f.dir, "feed.xml"));
  const rendered = await f.cli(
    "render",
    [],
    {
      COPILOT_ISOLATION_MODE: "render",
      COPILOT_ISOLATION_LOG: isolationLog,
      COPILOT_NETWORK_LOG: networkLog,
    },
    [guard, network],
  );
  assert.equal(rendered.code, 0, rendered.stderr);
  assert.equal(existsSync(isolationLog), false);
  assert.equal(existsSync(networkLog), false);
  execFileSync(
    process.execPath,
    [
      "--import",
      guard,
      "--input-type=module",
      "-e",
      "try { await import('./src/v2/discovery.js'); } catch {}",
    ],
    {
      cwd: join(import.meta.dirname, "../.."),
      env: {
        ...process.env,
        COPILOT_ISOLATION_MODE: "render",
        COPILOT_ISOLATION_LOG: isolationLog,
      },
    },
  );
  assert.match(readFileSync(isolationLog, "utf8"), /discovery/);
  execFileSync(
    process.execPath,
    [
      "--import",
      network,
      "--input-type=module",
      "-e",
      "try { await fetch('https://example.invalid'); } catch {}",
    ],
    { env: { ...process.env, COPILOT_NETWORK_LOG: networkLog } },
  );
  assert.match(readFileSync(networkLog, "utf8"), /attempted network access/);
});

test("a clean persisted symlink is rejected before acquisition and leaves the index bytes unchanged", async (t) => {
  const { symlinkSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { serve } = await import("./support.js");
  const f = new DirectoryFixture(t);
  mkdirSync(join(f.archive, "snapshots"));
  symlinkSync(
    join(f.dir, "outside.html"),
    join(f.archive, "snapshots", "escape.html"),
  );
  writeFileSync(join(f.dir, "outside.html"), "User-owned bytes");
  writeFileSync(
    join(f.archive, "metadata.json"),
    '{"schema_version":2,"articles":{}}\n',
  );
  f.persist("Unsafe saved archive");
  const index = readFileSync(join(f.archive, ".git/index"));
  let requests = 0;
  const base = await serve(t, (_req, res) => {
    requests++;
    res.end("<rss><channel/></rss>");
  });
  const result = await f.cli("capture", ["--feed-url", base]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /nonregular/);
  assert.equal(requests, 0);
  assert.deepEqual(readFileSync(join(f.archive, ".git/index")), index);
  assert.equal(
    readFileSync(join(f.dir, "outside.html"), "utf8"),
    "User-owned bytes",
  );
});

test("directory commands require an explicit target, refuse acquisition options for Render and support persisted empty archives", async (t) => {
  const { execFileSync } = await import("node:child_process");
  const { root } = await import("./support.js");
  const f = new DirectoryFixture(t);
  const args = [
    "--import",
    "tsx",
    join(root, "src/v2/capture-directory-cli.ts"),
  ];
  assert.throws(
    () =>
      execFileSync(process.execPath, args, {
        cwd: root,
        stdio: ["pipe", "pipe", "pipe"],
      }),
    /archive-dir PATH is required/,
  );
  const help = execFileSync(process.execPath, [...args, "--help"], {
    cwd: root,
  }).toString();
  assert.match(help, /capture:directory.*archive-dir/);
  assert.equal((await f.cli("render")).code, 1);
  assert.equal((await f.cli("capture", ["--timeout-ms", "0"])).code, 1);
  const captured = await f.cli("capture", ["--feed-url", f.feed("")]);
  assert.equal(captured.code, 0);
  f.persist("Empty Capture");
  const rendered = await f.cli("render");
  assert.equal(rendered.result.outcome, "no-change");
  assert.deepEqual(rendered.result.counts, {
    rendered: 0,
    updated: 0,
    unchanged: 0,
  });
  assert.equal(
    (await f.cli("render", ["--feed-url", "https://example.invalid"])).code,
    1,
  );
  assert.equal((await f.cli("render", ["--timeout-ms", "100"])).code, 1);
});

test("tracked changes hidden by index flags cannot pass the clean-checkout boundary", async (t) => {
  const { writeFileSync } = await import("node:fs");
  const f = new DirectoryFixture(t);
  assert.equal((await f.cli("capture", ["--feed-url", f.feed("")])).code, 0);
  f.persist("Empty archive");
  f.git("update-index", "--assume-unchanged", "metadata.json");
  writeFileSync(
    join(f.archive, "metadata.json"),
    '{"schema_version":2,"articles":{}}\n',
  );
  const result = await f.cli("render");
  assert.equal(result.code, 1);
  assert.match(result.stderr, /index flags|dirty/);
});
