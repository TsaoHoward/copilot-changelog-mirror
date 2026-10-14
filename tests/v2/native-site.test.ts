import assert from "node:assert/strict";
import { test } from "node:test";
import { loadDerivedPublication } from "../../src/v2/native-site-input.js";
import { NativeSiteFixture } from "./native-site-support.js";

test("derived-only publication joins every canonical record without requiring raw snapshots", async (t) => {
  const f = new NativeSiteFixture(t);
  f.seed([
    {
      slug: "saved",
      title: "Canonical <title> & tools",
      body: "Saved editorial body.\n",
    },
  ]);
  const publication = await loadDerivedPublication(f.archive);
  assert.equal(publication.length, 1);
  assert.equal(publication[0]?.title, "Canonical <title> & tools");
  assert.equal(publication[0]?.body, "Saved editorial body.\n");
  assert.equal(publication[0]?.publication_path, "/posts/saved/");
});

test("whole publication rejects incomplete, malformed and unsafe managed inputs cheaply", async (t) => {
  const { writeFileSync, rmSync, mkdirSync, symlinkSync } = await import(
    "node:fs"
  );
  const { join } = await import("node:path");
  const cases: Record<
    string,
    (
      f: NativeSiteFixture,
      manifest: import("../../src/v2/domain.js").Manifest,
      id: string,
    ) => void
  > = {
    "missing manifest": (f) => rmSync(join(f.archive, "metadata.json")),
    "missing body": (f, _m, id) => rmSync(join(f.archive, "posts", `${id}.md`)),
    "invalid JSON": (f) => writeFileSync(join(f.archive, "metadata.json"), "{"),
    "invalid schema": (f) =>
      writeFileSync(
        join(f.archive, "metadata.json"),
        '{"schema_version":1,"articles":{}}',
      ),
    "duplicate JSON key": (f) =>
      writeFileSync(
        join(f.archive, "metadata.json"),
        '{"schema_version":2,"schema_version":2,"articles":{}}',
      ),
    "identity mismatch": (f, m, id) => {
      m.articles[id]!.article_id = "../escape";
      writeFileSync(join(f.archive, "metadata.json"), JSON.stringify(m));
    },
    "incomplete new capture beside older content": (f, m) => {
      Object.values(m.articles)[1]!.canonical = null;
      f.writeManifest(m);
    },
    "blank title": (f, m, id) => {
      m.articles[id]!.canonical!.title = " ";
      writeFileSync(join(f.archive, "metadata.json"), JSON.stringify(m));
    },
    "invalid canonical time": (f, m, id) => {
      m.articles[id]!.canonical!.published_at = "2026-02-30T00:00:00.000Z";
      writeFileSync(join(f.archive, "metadata.json"), JSON.stringify(m));
    },
    "unsafe route": (f, m, id) => {
      m.articles[id]!.canonical!.publication_path = "/posts/../escape/";
      writeFileSync(join(f.archive, "metadata.json"), JSON.stringify(m));
    },
    "source route mismatch": (f, m, id) => {
      m.articles[id]!.canonical!.publication_path = "/posts/different/";
      f.writeManifest(m);
    },
    "legacy front matter": (f, _m, id) =>
      writeFileSync(
        join(f.archive, "posts", `${id}.md`),
        "---\ntitle: Legacy\n---\nBody",
      ),
    "empty legacy front matter": (f, _m, id) =>
      writeFileSync(join(f.archive, "posts", `${id}.md`), "---\n---\nBody"),
    "invalid UTF-8": (f, _m, id) =>
      writeFileSync(
        join(f.archive, "posts", `${id}.md`),
        Buffer.from([0xc3, 0x28]),
      ),
    "symlink metadata": (f) => {
      rmSync(join(f.archive, "metadata.json"));
      symlinkSync("/etc/passwd", join(f.archive, "metadata.json"));
    },
    "symlink body": (f, _m, id) => {
      rmSync(join(f.archive, "posts", `${id}.md`));
      symlinkSync("/etc/passwd", join(f.archive, "posts", `${id}.md`));
    },
    "nonregular body": (f, _m, id) => {
      rmSync(join(f.archive, "posts", `${id}.md`));
      mkdirSync(join(f.archive, "posts", `${id}.md`));
    },
    "symlink posts": (f) => {
      rmSync(join(f.archive, "posts"), { recursive: true });
      symlinkSync(f.dir, join(f.archive, "posts"));
    },
  };
  for (const [name, mutate] of Object.entries(cases))
    await t.test(name, async (t) => {
      const f = new NativeSiteFixture(t);
      const manifest = f.seed([{ slug: "older" }, { slug: "newer" }]);
      mutate(f, manifest, Object.keys(manifest.articles)[0]!);
      await assert.rejects(loadDerivedPublication(f.archive));
      if (name === "incomplete new capture beside older content") {
        const result = await f.cli();
        assert.notEqual(result.code, 0);
        assert.equal(result.result.output, undefined);
        assert.match(result.result.diagnostic, /Incomplete canonical/);
      }
    });
  await t.test("colliding routes across distinct sources", async (t) => {
    const f = new NativeSiteFixture(t);
    f.seed([
      { slug: "same" },
      { slug: "same", source: "https://example.invalid/elsewhere/same/" },
    ]);
    await assert.rejects(loadDerivedPublication(f.archive), /route collision/);
  });
  await t.test("symlink archive ancestor", async (t) => {
    const f = new NativeSiteFixture(t);
    f.seed();
    symlinkSync(f.archive, join(f.dir, "alias"));
    await assert.rejects(
      loadDerivedPublication(join(f.dir, "alias")),
      /symlink/,
    );
  });
});

test("configuration accepts root/repository bases and origin and rejects unsafe values", async () => {
  const { siteConfiguration } = await import(
    "../../src/v2/native-site-build.js"
  );
  assert.deepEqual(siteConfiguration("/"), { base: "/", site: undefined });
  assert.deepEqual(
    siteConfiguration("/copilot-changelog-mirror", "https://example.invalid"),
    { base: "/copilot-changelog-mirror/", site: "https://example.invalid" },
  );
  for (const base of [
    "",
    "relative",
    "//host/",
    "/a/../b/",
    "/a?query",
    "/%2e/",
  ])
    assert.throws(() => siteConfiguration(base));
  for (const site of [
    "",
    "file:///tmp/",
    "https://user:pass@example.invalid",
    "https://example.invalid/path",
    "https://example.invalid/?q",
    "https://example.invalid/#anchor",
  ])
    assert.throws(() => siteConfiguration("/", site));
});

test("unsafe or existing output fails before tools run and preserves archive and user output", async (t) => {
  const { mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync } =
    await import("node:fs");
  const { join } = await import("node:path");
  const { root } = await import("./support.js");
  const { tree } = await import("./search-support.js");
  const f = new NativeSiteFixture(t);
  f.seed([{ slug: "saved" }]);
  const before = tree(f.archive);
  const stale = join(f.dir, "stale");
  mkdirSync(stale);
  writeFileSync(join(stale, "sentinel"), "user output");
  symlinkSync(f.archive, join(f.dir, "alias"));
  for (const output of [
    join(f.archive, "nested/output"),
    f.dir,
    join(f.dir, "alias/output"),
    join(root, "site/new-output"),
    root,
    stale,
  ]) {
    const result = await f.cli(["--output", output]);
    assert.notEqual(result.code, 0, output);
    assert.equal(result.result.outcome, "failure");
    assert.equal(result.result.output, undefined);
    assert.deepEqual(tree(f.archive), before);
  }
  assert.equal(readFileSync(join(stale, "sentinel"), "utf8"), "user output");
  assert.ok(!existsSync(join(f.archive, "nested")));
});

test("actual Astro and Pagefind failures withhold completed output and preserve all archive bytes", async (t) => {
  const {
    cpSync,
    mkdirSync,
    writeFileSync,
    readFileSync,
    symlinkSync,
    existsSync,
    readdirSync,
  } = await import("node:fs");
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { join } = await import("node:path");
  const { root } = await import("./support.js");
  const { tree } = await import("./search-support.js");
  for (const stage of [
    "Astro",
    "Pagefind",
    "empty Pagefind invalid CLI option",
  ])
    await t.test(stage, async (t) => {
      const f = new NativeSiteFixture(t);
      f.seed(stage.startsWith("empty") ? [] : [{ slug: "saved" }]);
      const application = join(f.dir, "application");
      mkdirSync(application);
      for (const name of [
        "site",
        "src/v2/native-site-input.ts",
        "src/v2/native-site-build.ts",
        "src/v2/native-site-cli.ts",
        "src/v2/native-site-astro.ts",
        "src/v2/domain.ts",
        "package.json",
        "tsconfig.json",
      ]) {
        mkdirSync(join(application, name, ".."), { recursive: true });
        cpSync(join(root, name), join(application, name), { recursive: true });
      }
      symlinkSync(
        join(root, "node_modules"),
        join(application, "node_modules"),
      );
      if (stage === "Astro")
        writeFileSync(
          join(application, "site/src/pages/index.astro"),
          "---\nthis is invalid JavaScript !!!\n---\n",
        );
      else {
        const path = join(application, "src/v2/native-site-build.ts");
        writeFileSync(
          path,
          readFileSync(path, "utf8").replace(
            '"--glob",',
            stage.startsWith("empty")
              ? '"--unsupported-option", "--glob",'
              : '"--root-selector", "[", "--glob",',
          ),
        );
      }
      const cleanupGuard = join(f.dir, "cleanup-failure.mjs");
      if (stage === "Astro")
        writeFileSync(
          cleanupGuard,
          `
        import fs from "node:fs/promises";
        import { syncBuiltinESMExports } from "node:module";
        const rm = fs.rm;
        fs.rm = (path, options) => String(path).includes(".copilot-native-incomplete-")
          ? Promise.reject(new Error("controlled cleanup failure")) : rm(path, options);
        syncBuiltinESMExports();
      `,
        );
      const before = tree(f.archive);
      const output = join(f.dir, "output");
      let result;
      try {
        await promisify(execFile)(
          process.execPath,
          [
            ...(stage === "Astro" ? ["--import", cleanupGuard] : []),
            "--import",
            join(root, "node_modules/tsx/dist/loader.mjs"),
            join(application, "src/v2/native-site-cli.ts"),
            "--archive-dir",
            f.archive,
            "--output",
            output,
          ],
          { cwd: application },
        );
        assert.fail("Real tool failure must reject the command");
      } catch (error: any) {
        assert.equal(error.code, 1, error.stderr);
        result = JSON.parse(error.stdout);
        if (stage === "Astro")
          assert.match(error.stderr, /controlled cleanup failure/);
        assert.match(
          result.diagnostic,
          stage === "Astro" ? /Astro failed/ : /Pagefind failed/,
        );
      }
      assert.equal(result.outcome, "failure");
      assert.equal(result.output, undefined);
      assert.ok(!existsSync(output));
      assert.deepEqual(tree(f.archive), before);
      assert.equal(
        readdirSync(f.dir).some((name) =>
          name.startsWith(".copilot-native-incomplete-"),
        ),
        stage === "Astro", // Failed cleanup may leave only a clearly incomplete sibling.
      );
    });
});
