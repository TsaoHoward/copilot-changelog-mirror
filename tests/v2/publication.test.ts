import assert from "node:assert/strict";
import { test } from "node:test";
import {
  articleIdentity,
  comparePublications,
  emptyManifest,
  publicationIdentity,
  publicationProjection,
  serializePublicationProjection,
  updateCapture,
  updateRender,
} from "../../src/v2/domain.js";
import type { PublicationEntry } from "../../src/v2/domain.js";

const entry: PublicationEntry = {
  article_id: "article-0123456789ab",
  publication_path: "/posts/article/",
  title: "A title",
  published_at: null,
  source_url: "https://example.test/article/",
  body: "Body.\n",
};

test("publication format has fixed logical fields and order independent of storage representation", () => {
  assert.equal(
    serializePublicationProjection([entry]),
    '{"publication_format":1,"articles":[{"article_id":"article-0123456789ab","publication_path":"/posts/article/","title":"A title","published_at":null,"source_url":"https://example.test/article/","body":"Body.\\n"}]}\n',
  );
  const second = {
    ...entry,
    article_id: "another-0123456789ab",
    publication_path: "/posts/another/",
  };
  const reverseFields = Object.fromEntries(
    Object.entries(entry).reverse(),
  ) as unknown as PublicationEntry;
  assert.equal(
    publicationIdentity([entry, second]),
    publicationIdentity([second, reverseFields]),
  );
  assert.equal(
    serializePublicationProjection([]),
    '{"publication_format":1,"articles":[]}\n',
  );
  assert.match(publicationIdentity([]), /^[a-f0-9]{64}$/);
  const canonical = {
    title: entry.title,
    published_at: null,
    publication_path: entry.publication_path,
  };
  const identity = {
    article_id: entry.article_id,
    source_url: entry.source_url,
  };
  const current = {
    schema_version: 2,
    articles: {
      [entry.article_id]: {
        ...identity,
        canonical,
        capture: { observed_at: "old" },
      },
    },
  };
  const differentStorage = {
    storage_schema: 77,
    operational: "different",
    articles: {
      [entry.article_id]: {
        canonical,
        ...identity,
        capture: { observed_at: "new", raw_hash: "different" },
      },
    },
  };
  const bodies = new Map([[entry.article_id, entry.body]]);
  assert.equal(
    publicationIdentity(publicationProjection(current, bodies)!),
    publicationIdentity(publicationProjection(differentStorage, bodies)!),
  );
});

test("every publication field and article membership affects identity", () => {
  const original = publicationIdentity([entry]);
  const variations: Partial<PublicationEntry>[] = [
    { article_id: "different-0123456789ab" },
    { title: "Another title" },
    { published_at: "2026-10-01T00:00:00.000Z" },
    { publication_path: "/posts/new-path/" },
    { source_url: "https://example.test/other/" },
    { body: "Changed body.\n" },
  ];
  for (const patch of variations)
    assert.notEqual(
      publicationIdentity([{ ...entry, ...patch }]),
      original,
      Object.keys(patch).join(),
    );
  assert.notEqual(publicationIdentity([]), original);
  assert.equal(
    comparePublications([entry], [entry]).publication_outcome,
    "no-change",
  );
  assert.equal(
    comparePublications([entry], [{ ...entry, body: "Changed\n" }])
      .publication_outcome,
    "changed",
  );
});

test("capture fields and operational annotations never enter publication identity; incomplete prior state initializes", () => {
  const observation = {
    snapshot_sha256: "a".repeat(64),
    observed_at: "2026-10-01T00:00:00.000Z",
    discovery_title: "Unused feed title",
    discovery_published_at: null,
  };
  const source = "https://example.test/article/";
  const id = articleIdentity(source).article_id;
  let manifest = updateCapture(emptyManifest(), source, observation);
  const bodies = new Map([[id, "Body.\n"]]);
  assert.equal(publicationProjection(manifest, bodies), null);
  manifest = updateRender(manifest, id, {
    title: "Canonical",
    published_at: null,
    publication_path: "/posts/article/",
  });
  const projection = publicationProjection(manifest, bodies)!;
  for (const patch of [
    { snapshot_sha256: "b".repeat(64) },
    { observed_at: "2026-10-02T00:00:00.000Z" },
    { discovery_title: "Changed unused title" },
    { discovery_published_at: "2026-10-02T00:00:00.000Z" },
  ]) {
    const candidate = updateCapture(manifest, source, {
      ...observation,
      ...patch,
    });
    assert.equal(
      publicationIdentity(publicationProjection(candidate, bodies)!),
      publicationIdentity(projection),
    );
  }
  for (const field of [
    "run_id",
    "attempt_id",
    "git_sha",
    "stage_artifacts",
    "presentation_inputs",
  ]) {
    const shaped = { ...manifest, [field]: "ignored operational state" };
    assert.equal(
      publicationIdentity(publicationProjection(shaped, bodies)!),
      publicationIdentity(projection),
    );
  }
  assert.equal(publicationProjection(manifest, new Map()), null);
  const comparison = comparePublications(null, projection);
  assert.equal(comparison.publication_input, null);
  assert.equal(comparison.publication_outcome, "initialized");
  assert.equal(publicationProjection(emptyManifest(), new Map())?.length, 0);
  assert.throws(
    () =>
      publicationIdentity([
        { ...entry, publication_path: "/posts/../unsafe/" },
      ]),
    /Unsafe/,
  );
  assert.throws(
    () => publicationIdentity([entry, { ...entry, article_id: "another" }]),
    /collision/,
  );
});
