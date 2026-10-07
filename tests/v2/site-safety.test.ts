import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  cpSync,
  symlinkSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Fixture, seedArticle, root } from "./support.js";
import { exportArchive, siteCommand, copySite } from "./site-support.js";

function tree(directory: string, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, name.name);
    if (name.isDirectory())
      Object.assign(result, tree(path, `${prefix}${name.name}/`));
    else
      result[`${prefix}${name.name}`] = name.isSymbolicLink()
        ? "symlink"
        : readFileSync(path).toString("hex");
  }
  return result;
}

test("invalid and legacy publication inputs fail without mutation or a claimed artifact", async (t) => {
  const f = new Fixture(t);
  const id = seedArticle(f, "<article><h1>Title</h1><p>Body.</p></article>");
  assert.equal((await f.render()).code, 0);
  const valid = exportArchive(f);
  const cases: Record<string, (archive: string) => void> = {
    "missing manifest": (a) => rmSync(join(a, "metadata.json")),
    "invalid JSON": (a) => writeFileSync(join(a, "metadata.json"), "{"),
    "legacy manifest": (a) =>
      writeFileSync(
        join(a, "metadata.json"),
        '{"schema_version":1,"articles":{}}',
      ),
    incomplete: (a) => {
      const manifest = JSON.parse(
        readFileSync(join(a, "metadata.json"), "utf8"),
      );
      manifest.articles[id].canonical = null;
      writeFileSync(join(a, "metadata.json"), JSON.stringify(manifest));
    },
    "missing body": (a) => rmSync(join(a, "posts", `${id}.md`)),
    "legacy front matter": (a) =>
      writeFileSync(
        join(a, "posts", `${id}.md`),
        "---\ntitle: Legacy\n---\nBody.\n",
      ),
    "corrupt snapshot": (a) =>
      writeFileSync(join(a, "snapshots", `${id}.html`), "changed raw bytes"),
    "unsafe body": (a) => {
      rmSync(join(a, "posts", `${id}.md`));
      symlinkSync("/etc/passwd", join(a, "posts", `${id}.md`));
    },
    "unsafe route": (a) => {
      const manifest = JSON.parse(
        readFileSync(join(a, "metadata.json"), "utf8"),
      );
      manifest.articles[id].canonical.publication_path = "/../unsafe/";
      writeFileSync(join(a, "metadata.json"), JSON.stringify(manifest));
    },
    "legacy sidecar": (a) =>
      writeFileSync(join(a, "snapshots", `${id}.json`), "{}"),
  };
  for (const [name, change] of Object.entries(cases))
    await t.test(name, async () => {
      const archive = join(f.dir, name);
      cpSync(valid, archive, { recursive: true });
      change(archive);
      const before = tree(archive);
      const output = join(f.dir, `${name}-output`);
      const built = await siteCommand(f, archive, "build", [
        "--output",
        output,
      ]);
      assert.notEqual(built.code, 0);
      assert.equal(built.result.outcome, "failure");
      assert.ok(built.result.diagnostic);
      assert.equal(built.result.output, undefined);
      assert.equal(built.result.deployment_identity, undefined);
      assert.ok(!existsSync(output));
      assert.deepEqual(tree(archive), before);
    });
});

test("invalid output paths fail before creating anything in the archive and stale output is never fresh success", async (t) => {
  const f = new Fixture(t);
  seedArticle(f, "<article><h1>Title</h1><p>Body.</p></article>");
  assert.equal((await f.render()).code, 0);
  const archive = exportArchive(f);
  const before = tree(archive);
  const built = await siteCommand(f, archive, "build", [
    "--output",
    join(archive, "nested/output"),
  ]);
  assert.notEqual(built.code, 0);
  assert.deepEqual(tree(archive), before);
  assert.ok(!existsSync(join(archive, "nested")));
  const stale = join(f.dir, "stale");
  mkdirSync(stale);
  writeFileSync(join(stale, "index.html"), "previous artifact");
  const failed = await siteCommand(f, archive, "build", ["--output", stale]);
  assert.notEqual(failed.code, 0);
  assert.equal(failed.result.output, undefined);
  assert.equal(
    readFileSync(join(stale, "index.html"), "utf8"),
    "previous artifact",
  );
});

test("Astro compiler failure reports no artifact and preserves selected archive", async (t) => {
  const f = new Fixture(t);
  const source = copySite(join(f.dir, "site-source"));
  symlinkSync(join(root, "node_modules"), join(source, "node_modules"), "dir");
  writeFileSync(
    join(source, "site/src/pages/index.astro"),
    "---\nthis is invalid JavaScript !!!\n---\n",
  );
  seedArticle(f, "<article><h1>Title</h1><p>Body.</p></article>");
  assert.equal((await f.render()).code, 0);
  const archive = exportArchive(f);
  const before = tree(archive);
  const output = join(f.dir, "output");
  const result = await siteCommand(f, archive, "build", [
    "--source",
    source,
    "--output",
    output,
  ]);
  assert.notEqual(result.code, 0);
  assert.match(result.result.diagnostic, /Astro static build failed/);
  assert.equal(result.result.output, undefined);
  assert.ok(!existsSync(output));
  assert.deepEqual(tree(archive), before);
});
