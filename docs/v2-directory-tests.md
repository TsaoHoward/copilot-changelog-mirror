# Core test reassessment — issue #33

The replacement consolidates product assertions into inexpensive discovery,
domain and normalization seams plus focused directory CLI acceptance. All
existing gates in this inventory remain required by active `capture`/`render`
callers (`cli.ts`, stage writer, operational workflows and downstream site/Pages
paths). Their retirement is **deferred until those callers migrate**; additive
coverage alone is not authorization to remove them. No operational production
gates are retired in this delivery. Directory commands do not consume custom
Git/archive/publication protocols.

The shared acquisition and Render candidate construction is now in
`capture-batch.ts` and `render-batch.ts`. Product assertions can run against
buffers and saved maps; ordinary persistence and dirty-target behavior use a
small real Git integration. Identical-output, fallback, ownership, retention,
repair and route assertions are consolidated per seam rather than repeated
under every new Git failure setup. Existing production corpus assertions share
an unchanged frozen oracle with the migration-only comparison.

## Every affected historical case

Each row identifies its current guarantee through the original test name.
**Disposition for every row:** retain for its active production/shared caller;
use replacement coverage below for new commands; defer deletion/relocation of
the old case until that caller migrates. Production-only private-index,
publication-identity, remote-ref-selection and cleanup/ref-advance assertions
are not new directory guarantees. They remain old-caller gates, not replacement
requirements. Nested case matrices are listed after the table.

| Existing file / case (current guarantee)                                                                                              | Active caller          | Replacement coverage / deferred operational guarantee                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `acquisition.test.ts` — production HTTP transport follows redirects and preserves entity-body bytes under the discovery identity      | Production Capture     | directory-contracts: RSS/Atom and transport; directory: late Capture failure                                     |
| `acquisition.test.ts` — RSS and Atom normalize publication evidence, deduplicate equivalent discoveries and ignore update timestamps  | Production Capture     | directory-contracts: RSS/Atom and transport; directory: late Capture failure                                     |
| `acquisition.test.ts` — conflicting duplicate discovery observations fail before acquisition and persistence                          | Production Capture     | directory-contracts: RSS/Atom and transport; directory: late Capture failure                                     |
| `acquisition.test.ts` — invalid feeds, HTTP errors, timeouts, truncated responses and later article failures leave no partial archive | Production Capture     | directory-contracts: RSS/Atom and transport; directory: late Capture failure                                     |
| `acquisition.test.ts` — malformed and unsupported redirect targets return structured failure without advancing the archive            | Production Capture     | directory-contracts: RSS/Atom and transport; directory: late Capture failure                                     |
| `capture.test.ts` — the explicit CLI bootstraps original bytes in one orphan archive commit and an identical rerun is a no-op         | Production Capture     | directory-contracts: retention/observation ownership; directory: bytes/no-churn/empty CLI                        |
| `capture.test.ts` — raw and discovery changes preserve canonical state, older evidence, unrelated articles and dirty application work | Production Capture     | directory-contracts: retention/observation ownership; directory: bytes/no-churn/empty CLI                        |
| `capture.test.ts` — empty feeds bootstrap once and existing noncanonical JSON formatting remains unchanged                            | Production Capture     | directory-contracts: retention/observation ownership; directory: bytes/no-churn/empty CLI                        |
| `capture.test.ts` — an existing empty archive extends its history when initialized                                                    | Production Capture     | directory-contracts: retention/observation ownership; directory: bytes/no-churn/empty CLI                        |
| `domain.test.ts` — a capture creates a joined identity and deterministic manifest without canonical state                             | Shared domain contract | shared domain.test.ts; directory-contracts: joins/paths/routes                                                   |
| `domain.test.ts` — the shared API rejects corrupt schemas and duplicate JSON keys                                                     | Shared domain contract | shared domain.test.ts; directory-contracts: joins/paths/routes                                                   |
| `domain.test.ts` — stage APIs enforce ownership and immutable identities while preserving the other stage                             | Shared domain contract | shared domain.test.ts; directory-contracts: joins/paths/routes                                                   |
| `domain.test.ts` — equivalent maps serialize identically and meaningful source URL differences keep distinct identities               | Shared domain contract | shared domain.test.ts; directory-contracts: joins/paths/routes                                                   |
| `domain.test.ts` — archive validation accepts regular files and Markdown rules but rejects mismatched persisted metadata              | Shared domain contract | shared domain.test.ts; directory-contracts: joins/paths/routes                                                   |
| `invalid-state.test.ts` — invalid persisted state fails before acquisition without changing archive or application work               | Production Capture     | shared domain and directory-contracts; directory: persisted symlink and pre-acquisition refusal                  |
| `invalid-state.test.ts` — legacy or arbitrary application archives without a manifest are never treated as empty bootstrap state      | Production Capture     | shared domain and directory-contracts; directory: persisted symlink and pre-acquisition refusal                  |
| `git-safety.test.ts` — a fresh clone continues remote-only archive ancestry and preserves articles outside discovery                  | Production Capture     | directory: safety/overrides/late Capture/promotion/push rejection; production-specific ancestry remains deferred |
| `git-safety.test.ts` — archive targets reject checked-out branches, symbolic aliases and configured default branches                  | Production Capture     | directory: safety/overrides/late Capture/promotion/push rejection; production-specific ancestry remains deferred |
| `git-safety.test.ts` — capture ignores inherited Git overrides and leaves external index and working tree intact                      | Production Capture     | directory: safety/overrides/late Capture/promotion/push rejection; production-specific ancestry remains deferred |
| `git-safety.test.ts` — write and commit failures preserve the pinned archive and clean temporary indexes, including failed bootstrap  | Production Capture     | directory: safety/overrides/late Capture/promotion/push rejection; production-specific ancestry remains deferred |
| `git-safety.test.ts` — a competing archive commit cannot be overwritten after input is pinned                                         | Production Capture     | directory: safety/overrides/late Capture/promotion/push rejection; production-specific ancestry remains deferred |
| `git-safety.test.ts` — bare invocation requires an explicit subcommand and invalid options return truthful failure JSON               | Production Capture     | directory: safety/overrides/late Capture/promotion/push rejection; production-specific ancestry remains deferred |
| `git-safety.test.ts` — remote archive selection accepts identical tips and refuses ambiguous ancestry                                 | Production Capture     | directory: safety/overrides/late Capture/promotion/push rejection; production-specific ancestry remains deferred |
| `git-safety.test.ts` — archive branch selection ignores remote branches that only share the final name                                | Production Capture     | directory: safety/overrides/late Capture/promotion/push rejection; production-specific ancestry remains deferred |
| `render.test.ts` — offline render initializes canonical state once and preserves evidence on reruns                                   | Production Render      | directory-normalization: canonical stability/fallbacks; directory: derived repair/empty/offline                  |
| `render.test.ts` — network guard records an intentional attempt even when the caller catches it                                       | Production Render      | directory-normalization: canonical stability/fallbacks; directory: derived repair/empty/offline                  |
| `render.test.ts` — raw chrome and unused capture changes preserve publication; selected body/title/time change it                     | Production Render      | directory-normalization: canonical stability/fallbacks; directory: derived repair/empty/offline                  |
| `render.test.ts` — selected discovery fallbacks change publication and title/time never rename the public route                       | Production Render      | directory-normalization: canonical stability/fallbacks; directory: derived repair/empty/offline                  |
| `render.test.ts` — missing derived bodies repair offline and unrelated articles remain byte-for-byte intact                           | Production Render      | directory-normalization: canonical stability/fallbacks; directory: derived repair/empty/offline                  |
| `render.test.ts` — absent capture input fails; a persisted empty v2 archive renders an unchanged empty publication set                | Production Render      | directory-normalization: canonical stability/fallbacks; directory: derived repair/empty/offline                  |
| `render-metadata.test.ts` — equivalent associated Article, TechArticle, BlogPosting and WebPage dates normalize to one UTC instant    | Production Render      | directory-normalization: title/date authority and conflicts                                                      |
| `render-metadata.test.ts` — metadata fallback ignores malformed, invalid, unrelated and modified-only structured dates                | Production Render      | directory-normalization: title/date authority and conflicts                                                      |
| `render-metadata.test.ts` — conflicting associated publication instants fail the entire batch with identity and dates                 | Production Render      | directory-normalization: title/date authority and conflicts                                                      |
| `render-content.test.ts` — offline content conversion preserves code, relative media, useful TOC and punctuation/emoji section links  | Production Render      | directory-normalization: authentic extracts and synthetic gap fixture                                            |
| `render-content.test.ts` — a usable article H1 wins over page chrome and blank editorial H1 uses a usable page H1                     | Production Render      | directory-normalization: authentic extracts and synthetic gap fixture                                            |
| `render-safety.test.ts` — invalid input and late normalization failures never partially commit canonical state                        | Production Render      | directory-contracts: invalid data/routes; directory: late Render, safety and promotion failures                  |
| `render-safety.test.ts` — route collisions reject the whole batch without inventing a hash suffix                                     | Production Render      | directory-contracts: invalid data/routes; directory: late Render, safety and promotion failures                  |
| `render-safety.test.ts` — render preserves staged/unstaged/untracked application work and ignores inherited Git overrides             | Production Render      | directory-contracts: invalid data/routes; directory: late Render, safety and promotion failures                  |
| `render-safety.test.ts` — render refuses checked-out, symbolic and default archive targets                                            | Production Render      | directory-contracts: invalid data/routes; directory: late Render, safety and promotion failures                  |
| `render-safety.test.ts` — render continues pinned remote ancestry in a fresh clone without fetching or pushing                        | Production Render      | directory-contracts: invalid data/routes; directory: late Render, safety and promotion failures                  |
| `render-safety.test.ts` — Git write and commit failures leave the archive pinned and temporary indexes removed                        | Production Render      | directory-contracts: invalid data/routes; directory: late Render, safety and promotion failures                  |
| `render-safety.test.ts` — a competing ref advancement is never overwritten or reported as successful                                  | Production Render      | directory-contracts: invalid data/routes; directory: late Render, safety and promotion failures                  |
| `render-safety.test.ts` — cleanup failure cannot advance the archive and invocation-owned resources are removed                       | Production Render      | directory-contracts: invalid data/routes; directory: late Render, safety and promotion failures                  |
| `production-render.test.ts` — all six production articles retain the frozen 123 editorial blocks, structure, media and navigation     | Production Render      | directory-normalization: minimal conditions; directory-corpus.comparison.ts: migration-only original corpus      |

The matrices inside those cases remain covered:

- Acquisition: RSS/Atom duplicates, title fallback, normalized/null publication
  time, update exclusion; invalid XML/DOCTYPE/root/channel; redirects, malformed
  and unsupported locations, timeout, HTTP errors, truncated response and late
  acquisition. Production test keeps bootstrap/existing-archive variants;
  replacement transport checks use a local server and small buffers.
- Invalid Capture state: malformed JSON, duplicate keys (including escaped
  equivalent keys), schema version, unknown field, identity, invalid date,
  hash mismatch, missing snapshot, symlink, legacy snapshot, frontmatter,
  application object and manifest absence. Shared schema cases stay in
  `domain.test.ts`; path/hash/type/body checks use `directory-contracts.test.ts`;
  one persisted symlink checks filesystem rejection before acquisition.
- Render safety: corrupt manifest, legacy schema, hash mismatch, missing
  snapshot, snapshot/body symlink, legacy frontmatter, empty/unusable HTML and
  invalid UTF-8. Directory validation shares domain checks; normalization uses
  strict saved-byte contracts and one late full-batch failure.
- Metadata: associated Article/TechArticle/BlogPosting/WebPage, equivalent
  timezone instants, malformed/unrelated/modified-only/invalid dates, null
  discovery fallback and conflicting associated instants. Existing type/date
  matrices remain the comprehensive shared-normalizer gate; cheap replacement
  checks exercise authority/fallback/conflict without Git.
- Git: production-only orphan bootstrap, remote-only/ambiguous ancestry,
  symbolic/default/checked-out branches, private index writes/commit-tree and
  cleanup/ref races retain old callers. Directory acceptance instead requires
  a checked-out clean archive, preserves actual user index/worktree bytes,
  prevents optional Git index refresh writes, rejects hiding index flags,
  rechecks safety before promotion and lets ordinary non-fast-forward pushes
  protect remote history. No force/rebase/reset/reconciliation is introduced.

## Authentic conditions and one-time comparison

[Minimal fixture provenance](../tests/fixtures/minimal/README.md) maps every
original special condition to its small extract. Original captured sources
remain in `tests/fixtures/production/`; their frozen source-reviewed JSON
expectations remain unchanged. Code/emoji/relative media/embed/in-body-TOC gap
coverage is explicitly synthetic.

Run the migration comparison separately, not as a permanent replacement gate:

```sh
node --import tsx --test tests/v2/directory-corpus.comparison.ts
```

On 2026-10-14 (Asia/Taipei), the replacement rendered all six original saved
articles offline. Every frozen editorial block, title, heading, list/emphasis,
image, link, video and local navigation expectation matched; every snapshot
remained byte-identical. No semantic differences required resolution. The
historical six/123 assertion remains only in the active production gate and
this migration comparison; the replacement contracts use minimal conditions.

## Fresh measurements

Measured 2026-10-14 (Asia/Taipei) on local WSL2 x86_64, Linux
6.6.87.2-microsoft-standard-WSL2, Node v22.22.0 and npm 10.9.4. Baseline source
is `eef5ebb57db4c96717d08e4859da66ebbd86c45b`. Implementation source was copied
from this branch into a disposable snapshot based on that revision; its local
measurement snapshot is `8089598e2eb1b366457750714fdceb6a36bcea6c` (includes temporary
fixture-constructor instrumentation). Those measurement-only copies do not land
in the application. The checked-in [raw measurement record](v2-directory-measurements.json)
contains every repetition, environment and lockfile digest.

Both copies use the same existing `node_modules` and lockfile (SHA-256
`7062f8445365011714769409b0b94c574894960773e23ae2aba2c474f514e8dd`).
Dependencies are warm; OS filesystem/page caches are uncontrolled. Three serial
runs per group use `node --import tsx --test --test-concurrency=1`.
The local machine also hosted this interactive implementation session; these
are observed local costs, not dedicated CI-runner or cold-install benchmarks.

| Group                 | Wall seconds median (range) | Git processes/run | Fixture constructors/run | Constructor milliseconds total median (range) | Git initializations/run |
| --------------------- | --------------------------: | ----------------: | -----------------------: | --------------------------------------------: | ----------------------: |
| before-core           |      50.037 (49.379–50.501) |              1631 |                       71 |                        1371.1 (1322.1–1384.4) |                      73 |
| after-production-core |      50.340 (50.283–52.074) |              1631 |                       71 |                        1340.3 (1308.2–1369.7) |                      73 |
| after-cheap           |         0.695 (0.662–0.753) |                 0 |                        0 |                                 0.0 (0.0–0.0) |                       0 |
| after-directory       |         9.101 (9.086–9.125) |               220 |                       12 |                           182.1 (179.5–190.3) |                      17 |

The before/after production core groups contain acquisition, capture, domain,
invalid-state, git-safety, render, render-metadata, render-content, render-safety
and production-render files. The after-cheap group is shared domain plus
`directory-contracts` and `directory-normalization`; it replaces the product
assertion approach, not every old operational guarantee. After-directory is
`directory.test.ts`, including bare remotes and dirty-target cases. Git counts
come from `GIT_TRACE2_EVENT` start events, including child Git commands and
caller-owned persistence. Setup times bracket each Fixture/DirectoryFixture
constructor, including directories and initial Git commits; separately-created
bare repositories and application/competitor checkouts appear in initialization
counts but are not constructor times.

Checked-in saved fixture bytes consumed by the baseline core are 672063
(production HTML and frozen JSON plus the synthetic gap HTML). The cheap
replacement normalization group consumes 13514 bytes (three minimal
HTML extracts plus the synthetic gap HTML). README provenance is excluded.
Generated buffers and local-server responses are not checked-in fixture bytes;
no cumulative temporary working-tree size or whole-suite setup cost is claimed.

The standalone migration-only comparison took 4.086 seconds and 15 Git
processes in one observed run, using one archive constructor and the original
saved corpus. This separate cost was observed while the final full suite was
also running, so it is not a controlled before/after timing comparison. It is
excluded from the permanent replacement test group.

All measured groups passed. The retained production group remains about 50
seconds and 1631 Git processes; this additive delivery **does not claim an
overall CI speedup**. The cheap contracts avoid Git setup, and new directory
acceptance adds its own measured cost while old production gates remain active.
