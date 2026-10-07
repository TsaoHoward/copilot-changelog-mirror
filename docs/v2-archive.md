# V2 capture, offline render, and shared archive contract

Issues #18 and #19 introduce explicit Node.js/TypeScript capture, offline rendering, and the archive-domain API. Astro, remote push coordination, and production cutover are later deliveries. Production `mirror-data` still uses v1; the v2 commands reject that state with a reset/cutover diagnostic. Select a fresh branch or temporary repository for v2 verification.

## Run capture

Use Node.js 22.22.x and Git with an author name/email configured. `.node-version` pins the development and CI runtime; `package-lock.json` pins dependencies.

```sh
npm ci
npm run --silent capture -- --repo /path/to/repository --data-branch mirror-data-v2
npm run --silent capture -- --repo /path/to/repository --data-branch mirror-data-v2 --feed-url file:///path/to/feed.xml
```

The default feed is `https://github.blog/changelog/label/copilot/feed/`. The CLI defaults to the current repository and `mirror-data`, which must already be v2 or genuinely empty. An absent archive bootstraps as independent orphan ancestry; an existing empty archive is initialized on its existing ancestry. Bare `npm run --silent cli` fails without acquisition. `npm run --silent cli -- --help` describes the options. Use the silent npm flag or invoke `node --import tsx src/v2/cli.ts` directly to keep stdout exclusively the command's JSON.

RSS items and Atom entries are supported. Links resolve against the discovery URL and fragments are discarded. Titles fall back to the normalized source URL. `pubDate`/`published` provide publication evidence; `updated` does not. Absent/unparseable dates become null; valid publication instants use UTC milliseconds. Equivalent duplicate observations are deduplicated; conflicting duplicates fail the batch. Discovery covers the selected feed's current window, with no historical crawl or pruning of previously captured articles.

HTTP(S) acquisition retains entity-body bytes without text decoding, HTML normalization, or Markdown conversion. Requests ask for identity content encoding, follow at most ten HTTP(S) redirects, and retain the original discovery identity. `--timeout-ms` defaults to 30000 and bounds each acquisition including redirects and body transfer. File URLs are supported for local fixtures. Optional `COPILOT_CAPTURE_NOW` supplies a UTC acquisition instant for controlled fixtures; omit it for real acquisition.

## Storage and identity

```text
metadata.json
snapshots/<article_id>.html
posts/<article_id>.md          # derived, body-only canonical Markdown
```

`article_id` is the readable final URL path segment plus the first twelve lowercase SHA-256 hex characters of the normalized source URL. The segment is percent-decoded, stripped of a short filename extension, sanitized to ASCII letters/digits/underscore/hyphen, trimmed, and lowercased; an empty result uses `article`. Standard URL serialization normalizes scheme/host casing, default ports, and dot segments. Path casing, meaningful trailing slashes, and query order are preserved. Redirects do not change the stored source relationship.

The manifest has `schema_version: 2` and `articles`, keyed by `article_id`. Each entry has exactly these fields:

| Owner     | Fields                                                                                                        | Contract                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Immutable | `article_id`, `source_url`                                                                                    | Must match the key and deterministic normalized source identity                                                   |
| Capture   | `capture.snapshot_sha256`, `capture.observed_at`, `capture.discovery_title`, `capture.discovery_published_at` | Full lowercase SHA-256, UTC acquisition instant, string title, UTC publication instant or null                    |
| Render    | `canonical`                                                                                                   | Null initially, or `{ title, published_at, publication_path }`; title/path non-empty, publication instant or null |

All stored timestamps use `YYYY-MM-DDTHH:mm:ss.sssZ`. Snapshot locations derive from identity; public `publication_path` remains independent. Raw-only changes update the snapshot/hash/acquisition instant. Discovery-only changes preserve that instant and hash. Identical raw and discovery observations preserve persisted metadata bytes and the archive revision, even if the valid input JSON uses a different formatting or field order. Existing canonical metadata and body files are retained byte-for-byte. Git history preserves earlier snapshots; the manifest contains current state only.

Validation rejects malformed/duplicate-key JSON, unknown fields/versions, malformed types/hashes/timestamps, non-normalized URLs, identity/key mismatches, missing/non-regular snapshots, hash mismatches, unsafe/unjoined filenames, and legacy sidecars/front matter. The archive contains only its manifest and joined snapshot/body collections. The command validates both input and complete candidate state. It never performs a v1 migration or reset.

## Shared public API

Import from `src/v2/domain.ts` (use `.js` imports in TypeScript under NodeNext):

| Function                                                     | Purpose                                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `normalizeSourceUrl(input, base?)`, `articleIdentity(input)` | Source normalization and joined internal identity                                            |
| `emptyManifest()`                                            | An empty v2 current-state map                                                                |
| `readManifest(stringOrBytes)`, `validateManifest(value)`     | Strict JSON and schema validation                                                            |
| `updateCapture(manifest, sourceUrl, observation)`            | Creates or updates only capture state, with new canonical state null                         |
| `updateRender(manifest, articleId, canonical)`               | Updates only canonical publication fields on an existing identity                            |
| `validateTransition(previous, candidate, stage)`             | Enforces field ownership and refuses identity changes/deletion                               |
| `validateArchive(manifest, files)`                           | Validates manifest consistency with the file collection and snapshot hashes                  |
| `serializeManifest(manifest)`                                | Fixed two-space indentation, schema field order, lexical article order, and trailing newline |

Stage updates return candidate manifests and reject unknown patch fields, including identity fields or fields owned by the other stage. Callers must not directly mutate their input state. Rendering and bootstrap should reuse this contract rather than independently defining schema or identity rules. `ArchiveFiles` maps derived storage names to `{ mode, bytes }`; regular Git blob modes are accepted. Absent metadata is allowed only with a genuinely empty archive as a bootstrap input.

## Run offline render

```sh
npm run --silent render -- --repo /path/to/repository --data-branch mirror-data-v2
node --import tsx src/v2/cli.ts render --repo /path/to/repository --data-branch mirror-data-v2
```

Render reads a pinned existing archive and processes every persisted article in lexical article-ID order. It makes no feed, article, or media requests, performs no Git fetch/push, and runs no website build. Missing input requires capture first; a valid persisted empty v2 manifest renders successfully without a commit. `--feed-url` and `--timeout-ms` are capture-only options and are rejected by render. `COPILOT_CAPTURE_NOW` does not affect render.

Canonical title comes from the usable editorial H1, then a usable page H1, then trimmed discovery title, then source URL. The browser title is not used. Canonical publication time comes from article-associated JSON-LD `datePublished` in Article, TechArticle, BlogPosting, or associated WebPage records, including arrays and graphs. Matching URL, `@id`, or `mainEntityOfPage` references may differ by fragment or trailing slash without changing stored source identity. Valid timezone-qualified dates normalize to UTC milliseconds before uniqueness checking. Equivalent records are accepted; conflicting valid instants fail with identity and dates. Unrelated records, `dateModified`, malformed JSON-LD, and invalid dates are ignored. Without structured publication evidence, discovery time is used, including null.

Render preserves the production editorial container, meaningful lead images and embedded video, headings, lists, links, emphasis, and code. It removes duplicated titles, header metadata, page chrome, generated responsive TOCs, share controls, decorative images, and placeholder SVG images. One useful visible in-body TOC is retained where present. Relative links/media resolve against the stored source URL. Section links use deterministic `archive-heading-N` HTML anchors alongside Markdown headings so punctuation and emoji do not depend on a website's slug algorithm. Bodies use UTF-8, LF, and one trailing newline, without front matter or archive metadata.

Only `canonical` and joined Markdown bodies change. Capture observations, identities, source relationships, raw bytes/modes, and unrelated articles are retained. Routes follow `/posts/<readable-source-slug>/`, excluding the internal URL-hash suffix. Title/time changes do not rename routes. Unsafe paths and collisions fail the complete batch. All evidence, normalization, ownership, routes, and joined candidate bodies validate before persistence. Missing derived bodies repair from saved evidence; legacy front matter and unsafe objects fail rather than being migrated.

Identical canonical metadata/body bytes preserve the original manifest bytes, including its formatting, and the archive revision. A changed batch creates at most one descendant commit. `render(options)` in `src/v2/render.ts` exposes the same application command with `{ repo, branch }` for later orchestration.

## Canonical publication identity

The public domain API adds:

| Function                                     | Purpose                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `publicationProjection(archive, bodies)`     | Selects the logical publication fields from validated archive state and bodies keyed by article ID; returns null if any canonical record/body is absent |
| `serializePublicationProjection(projection)` | Fixed publication format 1, lexical article order, fixed field order, UTF-8 JSON escaping, and trailing newline                                         |
| `publicationIdentity(projection)`            | Full lowercase SHA-256 of the publication serialization                                                                                                 |
| `comparePublications(previous, candidate)`   | Returns input/output identities and initialized, changed, or no-change semantics                                                                        |

Each projection entry contains only `article_id`, `publication_path`, `title`, `published_at` (including explicit null), `source_url`, and canonical Markdown `body`. The source URL is the published attribution and relative-link relationship. An empty archive has a deterministic empty projection. `PublicationArchive` is a logical interface independent of the stored manifest version; accepting it does not relax strict v2 storage validation.

Identity excludes snapshot bytes/hashes, observation time, unused discovery values, manifest layout/schema, Git SHA, run/attempt IDs, stage artifacts, and presentation/build inputs. Equivalent logical projections serialize identically regardless of object insertion order or storage representation. Changes to any selected field or article membership change identity. This is archive-domain publication identity; deployment identity and Pages decisions remain later work.

Render reports archive persistence and publication semantics separately:

```json
{
  "outcome": "changed",
  "archive_input": "<pinned revision>",
  "archive_output": "<committed revision>",
  "counts": { "rendered": 1, "updated": 1, "unchanged": 0 },
  "publication_input": null,
  "publication_output": "<full SHA-256>",
  "publication_outcome": "initialized"
}
```

Counts cover all persisted articles; updated and unchanged partition rendered articles by canonical metadata/body changes. `publication_input: null` and `initialized` mean the previous derived state was incomplete, as on first render or missing-body repair. They do not claim a proven editorial change. Complete prior projections compare as changed or no-change. Raw-only or unused-discovery capture commits followed by render preserve canonical bytes and publication identity even when evidence has a new Git revision. Failures exit nonzero, report the pinned `archive_input` where available and null `archive_output`, and never claim successful publication output. Diagnostics go to stderr; results are not stored in the archive.

`capture(options)` in `src/v2/capture.ts` is the application command for later orchestration. It accepts repository, archive branch, feed URL, optional timeout and an acquisition clock. Operational pushes, remote freshness, queues, and downstream handoffs are outside this command.

## Git safety and result contract

Capture pins a local archive ref or, when no local archive exists, a matching remote-tracking archive tip regardless of remote name. Multiple identical remote tips are accepted; differing tips fail as ambiguous and require a pinned local branch. It stages a complete batch in a temporary Git index, never switches application HEAD, and preserves the application index and local work. It refuses checked-out archive branches, symbolic branch aliases, and known application/default branches. It clears inherited Git overrides so `--repo` selects the intended repository. One successful batch creates at most one commit. The ref advances against the pinned local input; a competing update causes failure. Temporary indexes are removed before the visible ref mutation. Failed batches can leave unreachable Git objects, but cannot advance the committed archive or claim a successful bootstrap. No push occurs.

Render reuses these safeguards and confirms the selected ref before reporting a no-op. Cleanup failure aborts the operation even if a best-effort retry removes the temporary index. A competing update is never overwritten.

A successful JSON result is shaped as:

```json
{
  "outcome": "changed",
  "archive_input": null,
  "archive_output": "<committed revision>",
  "counts": { "created": 1, "updated": 0, "unchanged": 0 }
}
```

`no-change` returns the unchanged revision; counts describe unique discovered articles, excluding retained entries outside discovery. `changed` describes acquisition state, without claiming a canonical publication change. A failed command exits nonzero and emits `{ outcome: "failure", archive_input, archive_output: null, diagnostic }` on stdout, with diagnostics on stderr. Results are never stored in archive metadata.

## Verification

The agreed acceptance seams are the real TypeScript CLI with acquired fixtures and temporary Git repositories, and the shared public domain API. HTTP fixture servers exercise production transport. Tests cover raw bytes, no-op reruns, chrome/discovery changes, ownership, corrupt/legacy state, dirty application work, remote ancestry, competing commits, and injected Git write/commit failures.

Every render acceptance invocation blocks HTTP(S), fetch, and network sockets and records attempted access, including caught attempts. A positive control verifies the guard; only the TypeScript loader's local IPC pipe is allowed. The six saved production articles are checked against the unchanged frozen 123 editorial blocks, structure, links, media, and navigation. Supplemental tests cover metadata authority, code, emoji fragments, repair, route collisions, cleanup failures, semantic results, and projection sensitivity/schema independence.

```sh
npm run format:check
npm run typecheck
npm test
node --import tsx --test tests/v2/capture.test.ts
```

The independent TypeScript CI job runs these checks with the pinned runtime. Existing Python/Jekyll CI and production entry points remain available through the coordinated cutover.
