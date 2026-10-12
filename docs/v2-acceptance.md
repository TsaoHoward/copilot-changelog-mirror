# Issue #24 acceptance record

Contract: [authoritative specification](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/24#issuecomment-6119967327). Implementation starts from default-branch revision `9e3e19604e2bb3aa7e935b44433855db2e482204` on `codex/issue-24-v2-production-cutover`.

**Production activation and hosted acceptance are pending.** An implementation branch and deterministic tests do not change the live production system. No final remote v1 checkpoint, production reset, v2 deployment or v2 scheduled observation is claimed in this record yet. Publish updates as comments on #24; preserve its body and specification.

Final local verification completed on 2026-10-12: locked `npm ci`, formatting, TypeScript typecheck, 279 Node tests (zero failures/skips), and 18 Chromium checks (zero failures/skips). The locked Chromium revision was installed under `/tmp/issue24-playwright` for the browser run. Runtime code reviewed and tested at `a544be3`; subsequent changes only record evidence/documentation.

## Local proof matrix

| Requirement                                                                                                                          | Deterministic command boundary / evidence                                                 | Status                                          |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Exact v1 blobs/modes/front matter and reachable history; caller work preserved                                                       | `tests/v2/cutover.test.ts`, disposable restore, Git fsck and bare remote                  | Passed; final Node suite                        |
| Disabled/drained legacy consumers; API uncertainty/conflicting refs/nonempty target/late write/competing bootstrap refused           | Cutover operator commands and production writer gate                                      | Passed; final Node suite                        |
| Fresh current-only acquisition, immutable reset-input/atomic initial-capture witness, absent/empty target ancestry, canonical render | Real capture/render against temporary bare remote; no legacy seeding                      | Passed; final Node suite                        |
| Node-only production, one Taipei capture schedule, queue/target/trigger agreement, least permissions                                 | Parsed active workflow/CI contracts                                                       | Passed; final Node suite                        |
| Identical acquisition preserves manifest bytes, observation time and history                                                         | Real acquisition after a later clock against deployed fixture corpus                      | Passed; final Node suite                        |
| Raw-only chrome changes preserve canonical body/metadata and both identities; no new build/deployment                                | Real capture/offline render/Pages selection against verified fixture baseline             | Passed; final Node suite                        |
| Unused discovery is a separate no-deployment scenario                                                                                | Same Pages integration seam with unchanged raw bytes                                      | Passed; final Node suite                        |
| Canonical body/title/time change both identities and rebuild pages/index                                                             | Real capture/render/actual Astro/Pagefind build and Pages boundary                        | Passed; final Node suite                        |
| Presentation-only changes deploy without canonical archive mutation                                                                  | Existing Pages command integration case                                                   | Passed; final Node suite                        |
| Manual modes, exact attempts, failures, retries, force, expiry and re-establishment                                                  | Stage and Pages integration suites; only hosted API/transport/deployment substituted      | Passed; final Node suite                        |
| Supersession at selection/preparation/push/deploy; uncertain Git/API fails                                                           | Writer race and Pages authorization suites                                                | Passed; final Node suite                        |
| Offline/editorial fidelity: six source articles, frozen 123 blocks, links/anchors/media                                              | Production-render and real site-production targeted suites: 20 assertions/subtests passed | Passed before runtime retirement                |
| Repository-base title/body search, result navigation, keyboard/mobile/empty/error states and refresh                                 | Finished Astro/Pagefind artifact served to Chromium                                       | Passed; 18 Chromium checks                      |
| Formatting, typecheck and complete Node suite                                                                                        | `npm run format:check`, `npm run typecheck`, `npm test`                                   | Passed; formatting/typecheck and 279 Node tests |

## Hosted proof matrix

| Scenario                                                                                                       | Target/scope                                                                                      | Status / evidence                                                  |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Quiescence, exact final v1 checkpoint and restoration export                                                   | Live `mirror-data` and immutable `v1-final-before-v2`                                             | Pending coordinated activation                                     |
| Fresh capture → independent render → actual Pages deployment                                                   | Live `mirror-data-v2`                                                                             | Pending merge/activation                                           |
| Public listing/order/routes/source/fragments/media/search/base path                                            | Live repository Pages URL                                                                         | Pending new deployment                                             |
| Raw-only source chrome, same presentation inputs, both identities equal, explicit duplicate/skipped deployment | Prefer real live upstream; otherwise clearly scoped separate hosted acceptance target/environment | Pending actual hosted proof                                        |
| Canonical and presentation inverse identity cases                                                              | Separate reviewed hosted acceptance target                                                        | Pending actual hosted proof                                        |
| Capture-only/render-only/render-and-publish/publish-only/retry/force/failures/supersession                     | Live nondestructive operations; isolated targets for deliberate mutations/failures                | Pending actual hosted proof                                        |
| Actual scheduled 06:17/12:17 Asia/Taipei capture event and downstream outcome                                  | Live production                                                                                   | Pending genuine `schedule` event; manual dispatch does not satisfy |

A read-only hosted recheck at **2026-10-12 10:47:16 UTC / 18:47:16 Asia/Taipei** confirmed default branch `main` at the original baseline, legacy archive `be5b40d1fd205137939f37ced96adfe19ef0fabc`, and absence of `mirror-data-v2` and the final checkpoint tag. This SHA is an observation, not a final checkpoint selection. The inventory observed legacy production active, with scheduled capture [38191651062](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/38191651062), render [38191672796](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/38191672796), and a failed Pages attempt [38191696674](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/38191696674). These are v1 observations, not v2 acceptance. The three existing v2 verification workflows were active and isolated. Reinventory and drain them as required by the runbook before claiming quiescence; this snapshot is not a lease.

## Required hosted record fields

For every observed scenario append UTC and Asia/Taipei times; repository/default branch/archive target; application and definition SHAs; input/candidate/persisted/output archive SHAs; capture/render/Pages URLs and exact attempts; origin/upstream selectors; durability ordering; publication and deployment identities; outcomes and advancement; baseline selected by completed deploy-step ordering; artifact ID/name/preparation attempt; completed job/step/results and evidence uploads; public URL and observed browser behavior. Preserve exported JSON reports and the checkpoint tree inventory alongside run links. Exported records aid review and do not replace runtime server verification.

Record each skipped deployment separately from a successfully completed deployment step. Keep failed or unobserved rows pending. Use [the runbook](v2-cutover.md) for actual activation and recovery; never inject fixture bytes into live upstream evidence or describe local/stub/upload-only proof as hosted deployment acceptance.

## Required code review

Reviewed `git diff 9e3e19604e2bb3aa7e935b44433855db2e482204...HEAD` independently using the code-review skill.

### Standards

No actionable findings. Documented archive/presentation ownership, ordinary atomic pushes, caller preservation, queue semantics and least deployment permissions are respected. No material baseline smells were found.

### Spec

The initial P1 fresh-bootstrap gap was fixed in `a544be3`: immutable reset input binds the absent/empty target; first capture persists its branch and witness atomically; subsequent state must descend from that witness. Regression coverage rejects copied verification state and partial marker publication. No remaining actionable code findings. Actual hosted acceptance remains pending.

Standards: 0 findings, no worst issue. Spec: 0 remaining actionable findings; hosted/scheduled acceptance remains unfulfilled pending activation.
