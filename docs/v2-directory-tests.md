# Core test reassessment — issue #33

The replacement consolidates product assertions into inexpensive discovery,
domain and normalization seams plus focused directory CLI acceptance. All
existing gates in this inventory remain required by active `capture`/`render`
callers (`cli.ts`, stage writer, operational workflows and downstream site/Pages
paths). Operational-gate retirement is **deferred until those callers migrate**; additive
coverage alone is not authorization to remove those gates. Metadata/content
product cases now run directly at the shared normalization seam, preserving
every source expectation while removing seven unnecessary Git fixture setups.
No operational production gates are retired in this delivery. Directory commands do not consume custom
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
**Disposition:** retain guarantees for every active production/shared caller;
relocate the two metadata authority/fallback cases and both content cases to the
shared saved-input normalizer; retain the conflicting-date CLI batch gate. For
all remaining rows, retain the existing test and use replacement coverage below for new commands; defer deletion/relocation of
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
| `render-metadata.test.ts` — equivalent associated Article, TechArticle, BlogPosting and WebPage dates normalize to one UTC instant    | Production Render      | shared render-metadata: relocated authority/fallback; retained production CLI conflict gate                      |
| `render-metadata.test.ts` — metadata fallback ignores malformed, invalid, unrelated and modified-only structured dates                | Production Render      | shared render-metadata: relocated authority/fallback; retained production CLI conflict gate                      |
| `render-metadata.test.ts` — conflicting associated publication instants fail the entire batch with identity and dates                 | Production Render      | shared render-metadata: relocated authority/fallback; retained production CLI conflict gate                      |
| `render-content.test.ts` — offline content conversion preserves code, relative media, useful TOC and punctuation/emoji section links  | Production Render      | directory-normalization: authentic extracts; shared render-content: relocated synthetic/media/anchor cases       |
| `render-content.test.ts` — a usable article H1 wins over page chrome and blank editorial H1 uses a usable page H1                     | Production Render      | directory-normalization: authentic extracts; shared render-content: relocated synthetic/media/anchor cases       |
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
- Metadata (relocated saved-input cases, retained CLI conflict): associated Article/TechArticle/BlogPosting/WebPage, equivalent
  timezone instants, malformed/unrelated/modified-only/invalid dates, null
  discovery fallback and conflicting associated instants. Type/date
  matrices now exercise the comprehensive shared-normalizer gate without Git.
  The conflicting-date production CLI case still proves whole-batch rejection.
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
6.6.87.2-microsoft-standard-WSL2, Node v22.22.0 and npm 10.9.4. Baseline application
source is `eef5ebb57db4c96717d08e4859da66ebbd86c45b`; implemented application
code is `0ae673a5dbeaae34656f13da27b7e61d94a8313e`. Final relocated tests were
measured in disposable snapshot `bbb399c6591724bfdea43326535f59ffc24ea5a8` based on
that code, with temporary constructor instrumentation. No measurement-only
instrumentation lands in the application. The [raw measurement record](v2-directory-measurements.json)
contains every corrected repetition, environment, source revisions and lockfile digest.

Both copies use the same installed `node_modules` and lockfile (SHA-256
`7062f8445365011714769409b0b94c574894960773e23ae2aba2c474f514e8dd`).
Dependencies are warm; OS filesystem/page caches are uncontrolled. Three serial
runs per group use `node --import tsx --test --test-concurrency=1`.
The local machine also hosted this interactive session; these are observed
local costs, not dedicated CI-runner or cold-install benchmarks. Corrected
comparisons ran without concurrent full-suite execution.

| Group                                    | Wall seconds median (range) | Git processes/run | Fixture constructors/run | Constructor milliseconds total median (range) | Git initializations/run |
| ---------------------------------------- | --------------------------: | ----------------: | -----------------------: | --------------------------------------------: | ----------------------: |
| Baseline production core                 |      47.687 (47.455–48.554) |              3563 |                       71 |                        1039.6 (1021.3–1049.7) |                      73 |
| Final retained/relocated production core |      48.925 (46.429–50.095) |              3306 |                       64 |                          999.1 (930.4–1041.4) |                      66 |
| Final cheap product contracts            |         1.189 (1.170–1.223) |                 0 |                        0 |                                 0.0 (0.0–0.0) |                       0 |
| Additive directory acceptance            |       10.305 (9.992–10.616) |               512 |                       12 |                           175.2 (168.7–195.1) |                      17 |

Before/after production core groups contain acquisition, capture, domain,
invalid-state, git-safety, render, render-metadata, render-content, render-safety
and production-render files. The final cheap group includes shared domain,
directory contracts/normalization and relocated render-content/metadata product
cases. The retained conflicting-date CLI case is excluded with the explicit
product-case name filter below; it remains in the production core group.
Directory acceptance is `directory.test.ts`, including bare remotes and
user-work safety. Counts/times compare the same cases before/after relocation;
additive tests are reported separately and do not replace operational gates.

```sh
node --import tsx --test --test-concurrency=1 \
  --test-name-pattern='cheap|directory candidate|discovery-only|minimal authentic|strict directory|raw-only|a capture creates|shared API|stage APIs|equivalent maps|archive validation|offline content|usable article H1|equivalent associated|metadata fallback' \
  tests/v2/domain.test.ts tests/v2/directory-contracts.test.ts \
  tests/v2/directory-normalization.test.ts tests/v2/render-content.test.ts \
  tests/v2/render-metadata.test.ts
```

Git-process counts use a temporary `git` executable shim on PATH: append its PID
to a counter file, then `exec` the real Git with unchanged arguments. This
includes CLI subprocesses that deliberately sanitize inherited `GIT_*`
environment variables. Injected failure wrappers that return before executing
real Git are excluded. Earlier trace-only counts omitted sanitized children
and are superseded by this record. Every corrected group uses the same shim;
its shell/log overhead is included. Initialization counts use trace events;
initialization is caller-owned in these groups. Fixture constructor timers
include directories and initial commits. Separately-created bare repositories
and competitor/application checkouts count as initializations, but are not
constructor timings.

Checked-in saved fixture bytes consumed by baseline core: 672063
(production HTML and frozen JSON plus synthetic gap HTML). Cheap replacement
normalization consumes 13514 bytes (three minimal HTML extracts plus
the shared synthetic gap HTML). Provenance README files, generated buffers and
local-server responses are excluded; no cumulative temporary checkout size or
whole-suite setup cost is claimed.

The migration-only comparison took 1.014 seconds and 40 Git executions in one
standalone corrected-counter run, with one archive constructor and the original
saved corpus. It is excluded from permanent replacement contracts. All corrected
measured groups passed.

Relocation removes seven Git fixture constructors and 257 real Git executions
from the retained core group. Its wall-time ranges overlap and its median is
slightly higher in this local sample, so **no runtime speedup is claimed**.
The new cheap product group uses no Git; directory acceptance adds its own
measured cost. This additive delivery does not claim an overall CI speedup.
