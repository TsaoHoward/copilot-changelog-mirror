import assert from "node:assert/strict";
import {
  readFileSync,
  cpSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  chmodSync,
} from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  publicationIdentity,
  publicationProjection,
} from "../../src/v2/domain.js";
import {
  deploymentIdentity,
  selectSiteInputs,
  serializeDeploymentProjection,
} from "../../src/v2/site-identity.js";
import { Fixture, root } from "./support.js";
import { copySite } from "./site-support.js";

const publication = [
  {
    article_id: "a",
    source_url: "https://github.blog/changelog/a/",
    title: "Title",
    published_at: null,
    publication_path: "/posts/a/",
    body: "Content.\n",
  },
];
const changeJson = (path: string, change: (input: any) => void) => {
  const input = JSON.parse(readFileSync(path, "utf8"));
  change(input);
  writeFileSync(path, JSON.stringify(input));
};

test("public deployment API normalizes supported representations and ignores source/definition operational churn", async (t) => {
  const f = new Fixture(t);
  const source = copySite(join(f.dir, "site"));
  const first = await selectSiteInputs({ source, publication });
  changeJson(join(source, "site-build.json"), (d) => {
    d.steps[0].node = "v22.22.0";
    d.steps[2].command.push("--", "--mode", "production");
    d.operational = {
      schedule: "hourly",
      application_sha: "deadbeef",
      run_id: 42,
      attempt: 9,
      artifact_name: "different",
      retention: 7,
      permissions: "read",
      deployment: "skipped",
    };
  });
  changeJson(join(source, "package.json"), (p) => {
    p.scripts.capture = "unrelated command";
    p.description = "Changed metadata";
    p.dependencies = Object.fromEntries(
      Object.entries(p.dependencies).reverse(),
    );
  });
  writeFileSync(join(source, "unrelated.txt"), "operational");
  mkdirSync(join(source, "site/.astro"));
  mkdirSync(join(source, "site/dist"));
  writeFileSync(join(source, "site/.astro/cache.json"), "generated cache");
  writeFileSync(join(source, "site/dist/index.html"), "previous output");
  const second = await selectSiteInputs({
    source,
    publication: [...publication].reverse(),
    base: "/copilot-changelog-mirror",
  });
  assert.equal(
    serializeDeploymentProjection(first.projection),
    serializeDeploymentProjection(second.projection),
  );
  assert.equal(
    deploymentIdentity(first.projection),
    deploymentIdentity(second.projection),
  );
});

test("deployment identity covers presentation closure, names, modes, locked dependencies, configuration and selected definition", async (t) => {
  const f = new Fixture(t);
  const cases: Record<string, (source: string) => void> = {
    layout: (s) =>
      writeFileSync(join(s, "site/src/layouts/Page.astro"), "changed layout"),
    styles: (s) =>
      writeFileSync(join(s, "site/src/styles/archive.css"), "changed styles"),
    "new client script": (s) =>
      writeFileSync(
        join(s, "site/src/new-client.js"),
        "console.log('interaction')",
      ),
    "removed route": (s) => rmSync(join(s, "site/src/pages/index.astro")),
    "added asset": (s) =>
      writeFileSync(join(s, "site/public/new.svg"), "<svg/>"),
    "removed asset": (s) => rmSync(join(s, "site/public/favicon.svg")),
    "renamed asset": (s) => {
      writeFileSync(
        join(s, "site/public/renamed.svg"),
        readFileSync(join(s, "site/public/favicon.svg")),
      );
      rmSync(join(s, "site/public/favicon.svg"));
    },
    "executable mode": (s) =>
      chmodSync(join(s, "site/public/favicon.svg"), 0o755),
    "website helper": (s) =>
      writeFileSync(join(s, "site/src/data.ts"), "changed helper"),
    "markdown config": (s) =>
      writeFileSync(
        join(s, "site/markdown.mjs"),
        "export const markdown = { gfm: false };",
      ),
    "route configuration": (s) =>
      writeFileSync(join(s, "site/astro.config.mjs"), "changed route config"),
    "TypeScript config": (s) =>
      changeJson(
        join(s, "tsconfig.json"),
        (d) => (d.compilerOptions.target = "ES2022"),
      ),
    "locked transitive dependency": (s) =>
      changeJson(
        join(s, "package-lock.json"),
        (d) => (d.packages["node_modules/astro"].integrity += "changed"),
      ),
    "install flags": (s) =>
      changeJson(join(s, "site-build.json"), (d) =>
        d.steps[1].command.push("--ignore-scripts"),
      ),
    "install settings": (s) =>
      writeFileSync(join(s, ".npmrc"), "ignore-scripts=true\n"),
    "build mode": (s) =>
      changeJson(join(s, "site-build.json"), (d) =>
        d.steps[2].command.push("--", "--mode", "testing"),
      ),
    "build environment": (s) =>
      changeJson(
        join(s, "site-build.json"),
        (d) => (d.environment.LC_ALL = "C"),
      ),
    "runtime pin": (s) => writeFileSync(join(s, ".node-version"), "22.22.1\n"),
  };
  const baseline = deploymentIdentity(
    (await selectSiteInputs({ source: root, publication })).projection,
  );
  for (const [name, change] of Object.entries(cases))
    await t.test(name, async () => {
      const source = copySite(join(f.dir, name));
      change(source);
      const result = await selectSiteInputs({ source, publication });
      assert.notEqual(deploymentIdentity(result.projection), baseline);
      assert.equal(
        result.projection.publication_identity,
        publicationIdentity(publication),
      );
    });
  for (const options of [{ base: "/" }, { site: "https://example.com" }]) {
    assert.notEqual(
      deploymentIdentity(
        (await selectSiteInputs({ source: root, publication, ...options }))
          .projection,
      ),
      baseline,
    );
  }
  const definition = join(f.dir, "separate-definition.json");
  cpSync(join(root, "site-build.json"), definition);
  assert.equal(
    deploymentIdentity(
      (await selectSiteInputs({ source: root, publication, definition }))
        .projection,
    ),
    baseline,
  );
  changeJson(definition, (d) => (d.environment.TZ = "Asia/Taipei"));
  assert.notEqual(
    deploymentIdentity(
      (await selectSiteInputs({ source: root, publication, definition }))
        .projection,
    ),
    baseline,
  );
});

test("canonical fields and membership change both identities; storage-shaped evidence does not", async () => {
  const baseline = (await selectSiteInputs({ source: root, publication }))
    .projection;
  for (const [field, value] of Object.entries({
    article_id: "b",
    source_url: "https://github.blog/changelog/b/",
    title: "New title",
    published_at: "2026-10-01T00:00:00.000Z",
    publication_path: "/posts/b/",
    body: "New body.\n",
  })) {
    const result = (
      await selectSiteInputs({
        source: root,
        publication: [{ ...publication[0]!, [field]: value }],
      })
    ).projection;
    assert.notEqual(
      result.publication_identity,
      baseline.publication_identity,
      field,
    );
    assert.notEqual(
      deploymentIdentity(result),
      deploymentIdentity(baseline),
      field,
    );
  }
  assert.notEqual(
    deploymentIdentity(
      (await selectSiteInputs({ source: root, publication: [] })).projection,
    ),
    deploymentIdentity(baseline),
  );
  const article = publication[0]!;
  for (const storage of [
    { schema_version: 2, capture: { observed_at: "today" } },
    { storage_version: 99, unused: "different" },
  ]) {
    const projection = publicationProjection(
      {
        ...storage,
        articles: {
          a: {
            article_id: "a",
            source_url: article.source_url,
            canonical: {
              title: article.title,
              published_at: article.published_at,
              publication_path: article.publication_path,
            },
          },
        },
      },
      new Map([["a", article.body]]),
    );
    assert.ok(projection);
    assert.equal(
      deploymentIdentity(
        (await selectSiteInputs({ source: root, publication: projection }))
          .projection,
      ),
      deploymentIdentity(baseline),
    );
  }
});

test("invalid/contradictory build inputs fail rather than hashing an unusable contract", async (t) => {
  const f = new Fixture(t);
  const cases: Record<string, (source: string) => void> = {
    phase: (s) =>
      changeJson(join(s, "site-build.json"), (d) =>
        d.steps.push({ kind: "build", command: ["npm", "run", "new-phase"] }),
      ),
    flag: (s) =>
      changeJson(join(s, "site-build.json"), (d) =>
        d.steps[2].command.push("--", "--unknown"),
      ),
    runtime: (s) =>
      changeJson(
        join(s, "site-build.json"),
        (d) => (d.steps[0].node = "22.22.1"),
      ),
    environment: (s) =>
      changeJson(
        join(s, "site-build.json"),
        (d) => (d.environment.UNKNOWN = "hidden input"),
      ),
    lock: (s) =>
      changeJson(
        join(s, "package.json"),
        (d) => (d.dependencies.astro = "1.0.0"),
      ),
    command: (s) =>
      changeJson(
        join(s, "package.json"),
        (d) => (d.scripts["site:astro"] += " && echo unexpected"),
      ),
    "missing input": (s) => rmSync(join(s, "site/astro.config.mjs")),
    "uncovered helper": (s) =>
      writeFileSync(join(s, "site/src/hidden.ts"), "import '../../hidden.js';"),
    dotenv: (s) => writeFileSync(join(s, ".env"), "PUBLIC_HIDDEN=untracked\n"),
    "absolute helper": (s) =>
      writeFileSync(
        join(s, "site/astro.config.mjs"),
        'import "/tmp/unselected-helper.mjs";',
      ),
    "file URL helper": (s) =>
      writeFileSync(
        join(s, "site/astro.config.mjs"),
        'import "file:///tmp/unselected-helper.mjs";',
      ),
    "npm build hook": (s) =>
      changeJson(
        join(s, "package.json"),
        (d) => (d.scripts["presite:astro"] = "node mutate-site.mjs"),
      ),
    "npm install hook": (s) =>
      changeJson(
        join(s, "package.json"),
        (d) => (d.scripts.postinstall = "node mutate-site.mjs"),
      ),
    "external tsconfig": (s) =>
      changeJson(
        join(s, "tsconfig.json"),
        (d) => (d.extends = "/tmp/unselected-config.json"),
      ),
  };
  for (const [name, change] of Object.entries(cases))
    await t.test(name, async () => {
      const source = copySite(join(f.dir, name));
      change(source);
      await assert.rejects(
        selectSiteInputs({ source, publication }),
        /Unsupported|Contradictory|Uncovered|Unreadable|Missing/i,
      );
    });
  for (const base of ["relative", "/../unsafe/", "/a//b/", "/a?b", "/a%2Fb/"])
    await assert.rejects(
      selectSiteInputs({ source: root, publication, base }),
      /Base/,
    );
});

test("selected workflow job changes cannot silently hide new build phases; operational YAML changes preserve identity", async (t) => {
  const f = new Fixture(t);
  const definition = join(f.dir, "workflow.yml");
  const yaml = `name: Static build\non: workflow_dispatch\npermissions: {contents: read}\nconcurrency: unchanged\njobs:\n  site:\n    runs-on: ubuntu-latest\n    env: {TZ: UTC, LANG: C.UTF-8}\n    steps:\n      - uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n      - uses: actions/setup-node@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n        with: {node-version-file: .node-version, cache: npm}\n      - run: npm ci\n      - run: npm run site:astro\n      - uses: actions/upload-pages-artifact@cccccccccccccccccccccccccccccccccccccccc\n        with: {name: old-artifact, retention-days: 1}\n`;
  writeFileSync(definition, yaml);
  const first = (
    await selectSiteInputs({ source: root, publication, definition })
  ).projection;
  writeFileSync(
    definition,
    yaml
      .replace("unchanged", "queue-changed")
      .replace("old-artifact", "new-artifact")
      .replace("retention-days: 1", "retention-days: 30"),
  );
  assert.equal(
    deploymentIdentity(
      (await selectSiteInputs({ source: root, publication, definition }))
        .projection,
    ),
    deploymentIdentity(first),
  );
  writeFileSync(definition, yaml.replace("npm ci", "npm ci --ignore-scripts"));
  assert.notEqual(
    deploymentIdentity(
      (await selectSiteInputs({ source: root, publication, definition }))
        .projection,
    ),
    deploymentIdentity(first),
  );
  writeFileSync(
    definition,
    yaml.replace("npm run site:astro", "npm run site:astro -- --mode testing"),
  );
  assert.notEqual(
    deploymentIdentity(
      (await selectSiteInputs({ source: root, publication, definition }))
        .projection,
    ),
    deploymentIdentity(first),
  );
  writeFileSync(
    definition,
    yaml.replace(
      "      - run: npm run site:astro",
      "      - run: npm run new-build-phase\n      - run: npm run site:astro",
    ),
  );
  await assert.rejects(
    selectSiteInputs({ source: root, publication, definition }),
    /Unsupported/,
  );
});
