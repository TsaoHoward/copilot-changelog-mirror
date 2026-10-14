# Presentation/search test reassessment for #34

Authority: issue #34's body and approved specification comment
`6166451630`. The new seams are the public derived-input loader/configuration,
public directory build command, and one shared real offline Astro/Pagefind
artifact served under the repository base. No production caller has migrated;
**all historical gates below are retained for their active callers**. No test is
removed merely to meet a count. Replacement identity/DSL guarantees are canceled.

## Active presentation cases

| Existing case                                                                | Guarantee and active caller                              | Replacement disposition/coverage                                                                                                                                                                                             |
| ---------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| site: canonical bodies/escaping plus identity-only agreement                 | Old site CLI and Pages; reader metadata/body correctness | Metadata/body/escaping/source/base in shared DOM/browser artifact; identity agreement remains old-only                                                                                                                       |
| site: canonical instants, lexical ties, nulls, empty                         | Both presentations                                       | One shared listing covers newest/tied/null order and omitted article time; small real empty build executes CLI indexing                                                                                                      |
| site: supplemental code, emoji/punctuation, TOC, relative media/embed        | Old presentation; real content cases                     | Shared synthetic code/emoji/HTML-H1/iframe and minimized authentic media cases; existing normalization contracts retain relative-media and substantive in-body TOC expectations                                              |
| site: evidence-only revisions/selected export/dirty application work         | Old selection/identity and read-only product boundary    | Derived-only join does not read evidence or Git; shared network/raw guard and byte comparison; old selected-tip and staged/index assertions remain old-only                                                                  |
| site: body headings cannot introduce second editorial H1                     | Both presentations                                       | Shared synthetic Markdown/HTML H1 DOM checks; new explicit-anchor/generated-heading collision case                                                                                                                           |
| site-production: each original authentic article at root and repository base | Old six-article gate and reader fidelity                 | Minimized source slices in routine shared artifact; one migration-only full-corpus comparison uses frozen blocks/title/date/source/sections/lists/emphasis/media and both real indexes; root checked in refresh/browser seam |

## Safety cases and affected support

| Historical safety parameter/case                                                                                | Guarantee and active caller              | Replacement disposition/coverage                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing manifest, invalid JSON, schema-1, null canonical, missing body, frontmatter, symlink body, unsafe route | Old build CLI; input completeness/safety | Cheap loader contracts, plus incomplete new capture beside old complete article through the command; adds duplicate JSON keys, source/key mismatch, invalid UTF-8/time/title, empty frontmatter, directory bodies, symlink metadata/posts/ancestors, route mismatch/collision |
| Corrupt snapshot and legacy raw sidecar                                                                         | Old full-archive audit                   | Retained old-only; directory Capture/Render and migration audit own raw integrity. Replacement successfully consumes derived state with inaccessible raw snapshots                                                                                                            |
| Archive-nested output and stale output                                                                          | Both build commands                      | Cheap command rejection, archive byte comparison and preserved output sentinel; adds output ancestors, source overlap and symlink aliases                                                                                                                                     |
| Actual malformed Astro compilation                                                                              | Both build commands                      | One small real malformed-template command failure; no completed output and all archive bytes preserved                                                                                                                                                                        |
| Actual Pagefind invalid selector                                                                                | Both build commands                      | One small real invalid-selector command failure; adds empty-corpus invalid CLI option so no-content handling cannot excuse general failure                                                                                                                                    |
| site-support export/CLI/copySite                                                                                | Old Git-selected CLI fixtures            | Retained unchanged; new plain directory fixture avoids Git for routine replacement contracts and primary browser setup                                                                                                                                                        |
| search-support server/openArtifact/tree                                                                         | Shared local artifact/browser seam       | Reused local-only browser routing and base-aware server; no remote media downloads                                                                                                                                                                                            |
| production-oracle and production/\*.json                                                                        | Old Render/fidelity gates                | Existing frozen semantic expectations reused directly for migration DOM assertions; no second Markdown body oracle added                                                                                                                                                      |
| site data/config/templates and Markdown pipeline                                                                | Both build paths                         | New data-file environment boundary falls back to old staged publication; ordinary Astro config remains shared; old search selected without native mode; shared explicit-anchor fix is covered by retained old site/production/browser gates                                   |
| package scripts/lock and workflow callers                                                                       | Existing CLI/Pages/CI                    | Lockfile unchanged; additive directory build; browser script includes both UI suites; workflow activation and existing entrypoint meanings unchanged                                                                                                                          |

## Identity/closure/DSL case dispositions

All five `site-identity.test.ts` top-level cases and every parameter below remain
for `site:identity`, old `site:build`, stage selection and Pages evidence callers.
None is imposed on the replacement:

- Public normalization and source/definition operational churn: representation
  and operational identity invariance stay old-only. Root/base/origin validity is
  preserved separately by cheap configuration and real base navigation.
- Closure changes: search component/client, indexing helper/options, locked
  indexer/native/transitive dependencies, layout/styles, new client, removed
  route, added/removed/renamed asset, executable mode, website helper, Markdown
  config, route config, TypeScript config, install flags/settings, mode,
  environment, runtime pin, base/site and separate selected definition. Identity
  assertions stay old-only; actual native builds and product behavior cover the
  replacement. Installation remains lockfile-based and outside the command.
- Canonical field/membership identity changes and storage-shaped evidence
  invariance: identity bytes stay old-only; updated/new/removed title/body terms
  and routes are covered by the small fresh-index browser check. Raw evidence is
  absent from the replacement adapter's reads.
- Invalid/contradictory inputs: phase, flag, runtime, environment, lock, command,
  missing input, uncovered/absolute/file-URL helper, dotenv, npm build/install
  hook, external tsconfig, and unsafe bases. DSL/closure rejection stays old-only;
  native compiler/indexer failure and supported base/origin validation cover the
  actual replacement contract. No import-closure audit engine is introduced.
- Selected workflow job: operational YAML invariance, install/build-mode changes,
  and hidden added phase rejection stay old-only. Replacement never interprets
  workflow YAML or package script definitions.

## Search case dispositions

| Historical browser case and parameters                                            | Guarantee/active caller               | Native behavior and coverage                                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title/body results, excerpts, highlight, root/repository URLs and navigation      | Both search UIs                       | Shared actual article/index, hostile escaped title/excerpt, body token, title query, keyboard result navigation; root URLs in small refresh artifact                                                              |
| Chrome/discovery exclusion and no matches                                         | Both search UIs                       | Shared synthetic discovery/provenance/footer exclusion; original-corpus title/body/footer comparison. A word occurring in editorial content is not a valid chrome-exclusion sentinel                              |
| Ten-result continuation, all results eventually available                         | Old batch size; product continuation  | Maintained five-result continuation verified against eight synthetic matches; exact batch size/classes/wording not contractual                                                                                    |
| Empty/whitespace clearing, delayed loading/new query/clearing delayed result      | Both search UIs                       | Native message/loading/current-query/clearing checks. UI owns its query state; old exact strings/delayed shard mechanics retained only for old caller                                                             |
| Failed UI/engine/entry/fragment/index assets, including 404                       | Both search UIs                       | Actual UI/engine/entry/index/fragment aborts plus real index 404 verify fallback and continued browsing; requested-asset counters prevent a false positive                                                        |
| Keyboard focus/input/results, long title/excerpt, 320px viewport                  | Both search UIs                       | Focus outline, keyboard activation, mobile no-overflow and screenshot; label/live status adapter and 44px clear target                                                                                            |
| JavaScript unavailable                                                            | Both presentations                    | Real JS-disabled listing/article/explicit-fragment navigation and browse fallback; native UI has no unusable control in that state                                                                                |
| Initial, evidence-only, edited, added/removed index rebuilds and application work | Old identities plus product freshness | Primary index reused as initial; one changed fresh corpus proves new/updated tokens and removal of old tokens/routes. Evidence-only identity rebuild remains old-only; archive bytes checked without Git fixtures |
| Empty corpus                                                                      | Both presentations                    | Small real Astro/CLI execution, explicit no-content outcome, navigable listing with no search control                                                                                                             |
| No query means no engine request                                                  | Old lazy-fetch implementation detail  | Not a product requirement. Native UI initialization/request timing is measured rather than frozen                                                                                                                 |

## Authentic and synthetic expectations

Reuse `tests/fixtures/minimal/README.md` traceability and saved extracts: nested
wrappers and sibling TOC, JetBrains list including substantive “Shared” wording,
feedback self-link/video/Community link, ordered introduction/list/emphasis, and
meaningful versus decorative media. Literal assertions are read from these saved
sources. Full migration expectations use immutable `production/*.json` blocks,
headings, links, media and lists; publication instants are literals independently
read from saved source JSON-LD. No fixture metadata framework is added.

Canonical ordering, hostile title/excerpt, code/emoji/body H1/iframe and search
sentinels are honestly synthetic gap inputs. Raw acquisition is positively blocked
in the primary artifact setup, including swallowed fetch attempts; browser
requests stay local and external media is checked as references only.

## Evidence and costs

The original-corpus comparison report is `v2-native-site-comparison.json`.
`differences: []` means no differences in the compared editorial DOM, metadata,
links, anchors or media. Search scope checks pass for both actual indexes.
Intentional UI differences are native continuation/section results, label/live
status/failure adapter and a no-JavaScript browse fallback. The synthetic heading
collision fix preserves explicit canonical anchors. Render already maps raw
self-linked headings to canonical `archive-heading-N` targets; both presentations
preserve that existing behavior. Equality here does not claim raw fragment IDs
are byte-identical to canonical ones. Independent review is complete; see [the two-axis review and saved-source
review](v2-native-site-review.md).

The accepted comparison uses one Render setup, one old build/index and one new
build/index, sequentially, with one original-corpus repetition. Two earlier
comparison development attempts exposed a bad chrome sentinel (an editorial word)
and a locator that confused the labeled form with its textbox; those attempts
used two additional old/new build pairs and are not performance samples. One
subsequent measurement was superseded when Vite cache placement was isolated for
both paths; that also used one old/new pair. No
six-article rebuild is performed for each reader assertion.

Routine replacement setup is one primary build/index shared across focused cases,
one changed corpus, one empty corpus, and small compiler/indexer failures. Cheap
contracts need no Astro/Pagefind; failure integration lives in the same test file
and has three real Astro attempts, two real Pagefind attempts. Coexistence keeps
all old gates, so this ticket adds their costs until caller migration. No claim is
made that additive coverage reduces total current CI time.

`v2-native-site-measurements.json` records runtime/OS/revision/dependency/browser,
corpus/base/cache/concurrency/repetition conditions, stage and setup costs,
accepted invocation counts and observed suite counts. Cold network dependency
installation, cold browser download and hosted runner timings were not measured.
Warm-cache offline installation and already-installed browser setup are measured
separately. API-versus-subprocess timing boundaries are explicit; one sample is
not a median, range or promised saving.

## Final verification

On code revision `97a63cb0dab33bb9cd858de08abbf9338c693c15`, the clean serial full contract suite
passed **326/326** tests in 340.45 seconds. Both serial Chromium suites
passed **31/31** checks in 42.78 seconds. Formatting and type checking passed.

The first full run applied review source edits while operational tests were still
running; their control-source revision gates correctly rejected that dirty
checkout. Review fixes were committed and the entire suite rerun cleanly. No
production guard was changed to accommodate the test environment.

The routine native browser group observed 3 Astro and 3 Pagefind starts,
with one primary artifact shared across checks plus small refresh/empty corpora.
The accepted original-corpus sample measured 2.406 seconds for the old command and
1.930 seconds for the replacement under the stated comparable conditions.
These are single measurements, without a savings target or median/range claim.
