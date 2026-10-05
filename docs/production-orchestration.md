# Production orchestration and recovery

Issue #14 extends #13's intentionally independent delivery into automatic progression. Acquisition, offline derivation, and publication remain three separately named Actions runs. Capture retains the schedule `17 6,12 * * *` with `Asia/Taipei`; render and Pages run only from completion events or manual dispatch. #13's earlier prohibition on automatic chaining applied to that delivery and is superseded by #14 for orchestration, with its archive and editorial semantics preserved.

## Durable boundaries

Capture invokes only the existing standard-library acquisition command. Render installs `uv.lock` dependencies and invokes only the existing saved-snapshot renderer. Each writer retrieves an exact remote archive revision, creates an ordinary additive commit when necessary, checks remote freshness, pushes without force, and verifies the remote head before emitting eligible output. On a first capture, the CLI bootstraps the orphan archive branch. No-change stages verify and reuse their persisted revision.

Render listens for successful completion of the capture workflow. Pages listens for successful completion of render. Both filter workflow name, trusted repository, production default branch, and success. The operational helper checks server run metadata, workflow path, repository, branch, revision, schema, run ID, and attempt again. Failed, cancelled, timed-out, or invalid upstream runs perform no downstream mutation. Automatic advancement uses `workflow_run`; archive pushes using `GITHUB_TOKEN` are not the trigger.

All three complete workflow runs, including manual operations, hold the same `copilot-archive-production` concurrency group with `cancel-in-progress: false` and `queue: max`. GitHub queues up to 100 pending runs in waiting order, which need not match dispatch order. No parent run holds the lock while waiting for a child. A manual run dispatched from another branch is skipped.

After acquiring the lock, render requires the remote archive head to equal its capture handoff; Pages requires the selected rendered revision. Writers recheck before pushing; Pages rechecks immediately before deploying. A newer coordinated or external archive update makes the older request `superseded`, without a stale remote push or deployment. A racing ordinary push can also fail visibly. Follow the newer chain, or dispatch recovery after it fails. Historical rollback is outside this feature.

## Evidence and no-op publication

Each attempt saves a version 1 `stage.json` result outside the content archive. Writer artifact names are `stage-capture-RUN-ATTEMPT` and `stage-render-RUN-ATTEMPT`. Automatic lookup downloads only the exact triggering attempt's artifact. Summaries include application/workflow-definition SHAs, archive input/output SHAs, originating and upstream runs, content changes, outcome, eligibility, and recovery history links. `changed`, `no-change`, `stage-only`, `superseded`, `duplicate`, and `failure` have different meanings; a successful skipped run does not imply a deployment.

Automatic render uses the capture's application SHA and archive SHA. Automatic Pages uses the render's application/site SHA and exact rendered archive SHA. The workflow tools come from the downstream run's recorded definition SHA. Manual publication can use the current default-branch site SHA with verified existing render output, allowing a site-only fix without recapturing or rerendering.

Render records its posts tree and publication input identity. Pages recomputes a SHA-256 identity from the posts tree, tracked Jekyll/static inputs, templates, configuration, plugins, staging command source, Gemfile/lock, Ruby/build configuration, and repository base URL. Run IDs, timestamps in stage evidence, archive housekeeping, and snapshot-only changes are excluded. Jekyll's tracked static inputs are included as well as templates; changes to the source SHA alone do not require publication when actual build inputs match.

Pages saves `publication-input-RUN-ATTEMPT` for the build/preparation outcome, then `stage-publish-RUN-ATTEMPT` for the deployment outcome. Only an eligible build reaches the dependent deployment job. A successful `actions/deploy-pages` step is recorded with its run, attempt, job ID, Pages artifact ID, publication identity, and URL. Future runs verify the exact completed Actions attempt and deployment job/step before accepting it as the latest successful comparison baseline. Reruns of older runs are ordered by deployment completion time. Failed publications and duplicate skips cannot replace that baseline. A first adoption with no compatible prior identity permits publication; API errors or malformed/contradictory evidence fail clearly.

Stage evidence is retained for 90 days, subject to repository retention settings and deletion. An expired or missing selected capture/render artifact fails rather than substituting the branch tip. Run a fresh capture-only or render-only operation to re-establish evidence from durable archive data. If the latest successful publication evidence expires or is removed, ordinary publication reports that lookup failure; explicitly force publication to establish a new verified baseline. Force bypasses duplicate suppression only, preserving successful-render evidence and freshness checks.

The Pages build artifact uses the exact name `github-pages-RUN-BUILD_ATTEMPT`; its default retention is one day. Rerunning only a failed deploy job downloads the original preparation attempt and deploys that original artifact, after rechecking freshness and the latest publication baseline. Outcome evidence uses the new attempt number. After the build artifact expires, start a new publish-only run to rebuild from the same durable render revision; it performs no acquisition or derivation.

## Manual operations

Run from the repository clone with `gh` access. Production workflows must already be on `main`, and the repository's Pages source must be **GitHub Actions**.

```sh
# Default manual capture advances the complete chain.
gh workflow run mirror-and-publish.yml --ref main -f advance=true

# Save source for inspection, without automatic derivation.
gh workflow run mirror-and-publish.yml --ref main -f advance=false

# Repair/verify posts using current persisted snapshots, without publication.
gh workflow run render-posts.yml --ref main -f advance=false

# Resume after a renderer fix and advance into Pages.
gh workflow run render-posts.yml --ref main -f advance=true

# Publish-only recovery: resolve current archive to successful render evidence.
gh workflow run publish-pages.yml --ref main

# Select one successful render run and exact attempt explicitly.
gh workflow run publish-pages.yml --ref main -f render_run_id=123456 -f render_attempt=1

# Deliberately redeploy unchanged current inputs / renew expired publication evidence.
gh workflow run publish-pages.yml --ref main -f force=true
```

An explicit render run/attempt must still describe the current remote archive. Supplying only one of the two selector fields is an error. Render-only evidence is valid for manual publication even though it prohibits automatic advancement. A successful capture-only or render-only run may produce a downstream Actions run that records `stage-only` and performs no derivation/build/deployment.

After a capture failure, retry capture. After render or render-push failure, the remote capture remains durable: start render-only to inspect repairs or render-and-publish to resume. After staging/Jekyll/deployment failure, use publish-only with the successful render evidence; no capture or render is required. For superseded output, inspect the newer chain instead of forcing the old revision. Evidence upload failures fail the upstream workflow and stop automatic advancement even if its archive push succeeded.

## Validation and hosted acceptance

Deterministic tests use the production operational helper, real fixture acquisition, local bare Git remotes, ordinary commits/pushes, blocked source HTTP during rendering, exact attempt artifact downloads through a stub hosted HTTP API, real staging/Jekyll builds, and a stub deployment outcome boundary. They verify durability, failures, retries, identity changes, duplicate suppression, manual modes, stale requests, and deployment metadata. Existing saved-production/editorial regression tests remain unchanged. These tests do not emulate GitHub's event engine.

Local commands (the helper is standard library; Python dependencies remain locked):

```sh
uv sync --locked
bundle install
uv run ruff check .
uv run ruff format --check .
uv run python -m unittest discover -s tests -v
```

Hosted acceptance remains pending until the implementation is merged onto the default branch. Do not claim a live deployment from local tests. After merge:

1. Run manual capture with advancement; record all three run URLs/attempts, application/archive SHAs, the two persistence boundaries, and successful Pages artifact/job/URL evidence in issue #14.
2. Repeat unchanged input; record stable archive history and a `duplicate` publication outcome with no additional deployment.
3. Exercise capture-only, render-only, render-and-publish, publish-only, explicit render selection, force, and a failed-job rerun using controlled inputs. Verify queued/freshness outcomes without corrupting production snapshots or replacing the live site with bad content.
4. Verify the timezone/cadence configuration and the first scheduled run separately. Manual-chain success alone is not scheduled-trigger evidence.

`actionlint` v1.7.12 predates GitHub's documented `concurrency.queue` key. Its only ignored diagnostic is that exact unsupported-key message; workflow contract tests separately require `queue: max`. All other workflow syntax is checked normally. The hosted checks above still establish actual platform acceptance.

References: [workflow completion events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run), [shared concurrency and queue semantics](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency), [repository-token trigger behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow), [exact workflow run attempts](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run-attempt).
