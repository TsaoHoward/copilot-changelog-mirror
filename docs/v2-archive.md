# V2 capture and shared archive contract

Issue #18 introduces explicit Node.js/TypeScript capture and the archive-domain API. Rendering, Astro, remote push coordination, and production cutover are later deliveries. Production `mirror-data` still uses v1; capture rejects that state with a reset/cutover diagnostic. Select a fresh branch or temporary repository for v2 verification.

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
posts/<article_id>.md          # owned by later rendering
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

`capture(options)` in `src/v2/capture.ts` is the application command for later orchestration. It accepts repository, archive branch, feed URL, optional timeout and an acquisition clock. Operational pushes, remote freshness, queues, and downstream handoffs are outside this command.

## Git safety and result contract

Capture pins a local archive ref or, when only that exists, `origin/<archive-branch>`. It stages a complete batch in a temporary Git index, never switches application HEAD, and preserves the application index and local work. It refuses checked-out archive branches, symbolic branch aliases, and known application/default branches. It clears inherited Git overrides so `--repo` selects the intended repository. One successful batch creates at most one commit. The ref advances against the pinned local input; a competing update causes failure. Temporary indexes are removed before the visible ref mutation. Failed batches can leave unreachable Git objects, but cannot advance the committed archive or claim a successful bootstrap. No push occurs.

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

```sh
npm run format:check
npm run typecheck
npm test
node --import tsx --test tests/v2/capture.test.ts
```

The independent TypeScript CI job runs these checks with the pinned runtime. Existing Python/Jekyll CI and production entry points remain available through the coordinated cutover.
