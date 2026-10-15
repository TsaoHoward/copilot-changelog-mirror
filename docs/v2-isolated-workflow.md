# Isolated directory update and publication

Issue #35 integrates the directory commands through native Actions. The reviewed
workflow is [the inactive template](../.github/isolated/update-publish.yml), with
one archive/build job and one dependent native Pages deployment job. It is outside
`.github/workflows`, so it registers no replacement trigger in production.
Independent literal repository/default-branch/event guards prevent its jobs from
writing or deploying there even if someone copies the template prematurely.
The existing production chain remains active. #36 owns any sole-chain production
cutover and production schedule observation; #24 remains separate.

The fixed acceptance target is `TsaoHoward/copilot-changelog-isolated-35`, with
its own `main`, `mirror-data-v2`, `github-pages` environment, native Actions token,
and `https://tsaohoward.github.io/copilot-changelog-isolated-35/` site. It has no
production workflow completion consumers or copied credentials. A second
environment in the production repository would not provide a separate Pages site.

## Provision and install the reviewed workflow

Use a new disposable application directory. Export the reviewed issue commit,
remove all production workflows **before the first push**, and install only the
template as `.github/workflows/update-publish.yml`. Do not fork with active
production workflows or import the production archive. Example (replace the
reviewed commit with the actual full issue-branch commit):

```sh
source_repo=/absolute/path/copilot-changelog-mirror
reviewed_commit=FULL_REVIEWED_COMMIT
isolated_app=$(mktemp -d /tmp/copilot-isolated-app.XXXXXX)
git -C "$source_repo" archive "$reviewed_commit" | tar -x -C "$isolated_app"
# Only the disposable export above is removed, never the source repository.
rm -r "$isolated_app/.github/workflows"
mkdir "$isolated_app/.github/workflows"
cp "$isolated_app/.github/isolated/update-publish.yml" \
  "$isolated_app/.github/workflows/update-publish.yml"
git -C "$isolated_app" init -b main
git -C "$isolated_app" add .
git -C "$isolated_app" commit -m 'Install reviewed isolated #35 integration'
gh repo create TsaoHoward/copilot-changelog-isolated-35 --public \
  --source "$isolated_app" --remote origin --push
```

Prepare a separate empty Git repository on `mirror-data-v2`, create an empty
initial commit, add only this isolated remote, and push it normally. A blank
branch intentionally lets Capture initialize metadata; never reset an existing
archive. Create the `github-pages` environment and configure Pages for Actions:

```sh
repo=TsaoHoward/copilot-changelog-isolated-35
gh api --method PUT "repos/$repo/environments/github-pages"
gh api --method POST "repos/$repo/pages" -f build_type=workflow
```

Inspect the environment's deployment branch/protection rules and ensure the
isolated default branch is allowed. Check `gh api "repos/$repo/actions/workflows"`
contains only the reviewed integration. Production is not an eligible target.

The fixed `acceptance-source` branch hosts a small RSS feed and two authentic
minimized source extracts from `tests/fixtures/minimal/weekly-skills.html` and
`feedback-video.html`. Copy them unchanged, with the fixture README documenting
original sources, conditions and independent expectations. Feed links identify
those files at the isolated raw GitHub URL. Captures are observations of these
fixture URLs, **not** new captures of the original GitHub Blog URLs. All fixture
captures stay in this isolated archive. This feed is trusted configuration in the
template, not a free-form dispatch target or production fault switch.

## Select a mode and inspect its records

```sh
repo=TsaoHoward/copilot-changelog-isolated-35
gh workflow run update-publish.yml --repo "$repo" --ref main -f mode=full-update
gh run list --repo "$repo" --workflow update-publish.yml --limit 5
gh run view RUN_ID --repo "$repo" --log
```

`full-update` captures, commits/pushes C, renders offline, separately commits/pushes
R, compiles with actual Astro, indexes with locked Pagefind, uploads native Pages
output, then deploys. Capture-only stays the directory CLI. `render-rebuild`
skips Capture; `republish` skips both stages and all archive persistence. Each
build validates the whole canonical/body publication, including null canonical
records beside older complete articles. Republish may intentionally use complete
older canonical content beside newer raw evidence; it does not claim a rerender.

All modes share workflow concurrency through deployment, with `queue: max` and
`cancel-in-progress: false`. This coordinates participating runs in the isolated
repository; external writers remain possible and scheduled events are not
promised execution. Schedule design is 06:17/12:17 Asia/Taipei. Configuration,
actual scheduled events, and successful executions are separate observations.
Only the isolated installation registers that schedule for #35.

The workflow fixes application SHA and the selected initial archive SHA once.
Application and archive checkouts are disjoint siblings; write modes keep the
archive attached to `mirror-data-v2`. An optional full `application_sha` must be
reachable in trusted default-branch history and expose all three directory
commands. Historical `archive_sha` is restricted to republish and must be an
ancestor of the selected archive head. Unknown modes/invalid combinations fail
before archive credentials are saved. Do not refetch a moving archive mid-run.

The archive/build job has contents-write permission even in republish; its
read-only command path does not reduce that shared job token scope. Only the
native deploy job has Pages-write and OIDC permission. It needs successful build
and upload and installs no application dependencies or history/evidence client.

Summaries/logs record event/mode, workflow/application SHA, selected archive SHA,
Capture/Render input and successfully pushed output revisions, changed/no-change
and command/article counts, run link, native outcomes and returned Pages URL.
Skipped stages are not executed and have selected saved input, not inferred
historic provenance. A command success/local commit is not confirmed persistence.
No-change stages still perform an ordinary push before advancing. A nonzero push
halts even if its remote outcome is uncertain; no force/rebase/reconciliation.

## Fresh recovery and known-good republish

After a failed stage, preserve its earlier remote commits and inspect the failed
step. A partial filesystem promotion may leave only a dirty disposable runner
checkout: never commit it. Fresh runs select a clean saved archive. For capture
or render push uncertainty, inspect the remote head/history before fresh dispatch;
do not rewind or automatically reconcile competing work.

```sh
# Retry acquisition, or repair the renderer in trusted application history first.
gh workflow run update-publish.yml --repo "$repo" --ref main -f mode=full-update
# Repair durable saved source without acquiring it again.
gh workflow run update-publish.yml --repo "$repo" --ref main -f mode=render-rebuild
# Retry build/upload/deploy from current complete derived data.
gh workflow run update-publish.yml --repo "$repo" --ref main -f mode=republish
# Rebuild a known-good publication using a compatible trusted application commit.
application_sha=FULL_COMPATIBLE_APPLICATION_SHA
archive_sha=FULL_COMPLETE_DERIVED_ARCHIVE_SHA
gh workflow run update-publish.yml --repo "$repo" --ref main \
  -f mode=republish -f application_sha="$application_sha" -f archive_sha="$archive_sha"
```

These are fresh native runs with fresh output/artifacts. An expired Pages artifact
is recovered by rebuilding from retained Git inputs; no historical summary/proof
or artifact renewal is required. Native reruns use the original event/ref/SHA;
re-running failed deployment jobs may try the old artifact, and a full rerun can
select a newer archive head. Prefer fresh dispatch for intended current inputs;
explicitly select both known-good revisions for reproducible saved publication.
Never assume old application code supports the replacement commands: if it does
not, use a compatible reviewed revision or documented manual native build/upload/
deploy from a compatible checkout rather than claiming an executable old command.

Equivalent local recovery uses disjoint application/archive directories:

```sh
cd "$application" || exit 1
npm ci || exit 1
npm run render:directory -- --archive-dir "$archive" || exit 1
GITHUB_OUTPUT=/tmp/render-output GITHUB_STEP_SUMMARY=/tmp/render-summary \
  bash "$workflow_tools/.github/isolated/persist-stage.sh" render "$archive" || exit 1
# For read-only historical republish, select the saved archive in a NEW checkout.
# Skip Render and persistence entirely for saved-derived republish.
npm run site:build:directory -- --archive-dir "$archive" \
  --output "$fresh_output" --base /copilot-changelog-isolated-35/ \
  --site https://tsaohoward.github.io || exit 1
```

Before deploy is called, an upstream failure prevents publication. After native
deployment is invoked, a failed response or later summary failure proves neither
old nor new public bytes. Inspect `gh run view`, `gh api "repos/$repo/pages"`,
native deployment status, and the actual listing, article and title/body search.
Record observed content and then dispatch fresh/known-good republish as needed.
Do not deliberately break the Pages service to test this condition.

## Evidence and ownership

See [the integration record](v2-isolated-workflow-evidence.md) for local versus
hosted results, pending observations and costs. The bounded hosted milestone is
full-update, one reversible Capture-success/Render-failure, offline recovery via
render-rebuild, and explicit known-good republish. Inspect native steps, remote
ancestry and public listing/article/source/base assets/title+body search/result
navigation. A disposable isolated renderer repair may support a deliberately
unsupported fixture layout; that source change must remain isolated. Do not
add a production fault switch or repeat all local failure permutations hosted.

| Existing guarantee / active caller                                                         | Disposition and replacement owner                                    | Evidence layer and coverage                                                                                                                                                           |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture bytes, hashes, ownership, whole-stage rejection; directory CLI                     | Retain #33                                                           | Routine `directory*.test.ts`; acquisition guards and late-stage failure, now reusing the actual Actions persistence shell in durable-C/offline-repair test                            |
| Separate durable C/R and push refusal; new workflow                                        | #35 owns caller behavior                                             | Routine `isolated-persistence.test.ts`: real remotes, competitor preservation on both stages including no-change, uncertain status propagation, confirmed R across downstream failure |
| Mode skips, input pins, schedule, permissions, concurrency, gates                          | #35 owns YAML and direct entry shell                                 | Routine `isolated-workflow.test.ts`; inactive production template and independent mutation/deploy guards; native execution established only hosted                                    |
| Complete canonical input, output safety, actual compiler/index failure; directory site CLI | Retain #34                                                           | Routine `native-site.test.ts`; existing older-complete/new-null rejection and real Astro/Pagefind failure; strict workflow success gates reused                                       |
| Read-only saved-derived build                                                              | #35 caller, #34 build                                                | Routine real archive/index/refs/history and offline build in `isolated-persistence.test.ts`; hosted known-good republish checks remote history                                        |
| Article/browser/search behavior; both presentations                                        | Keep #34 and still-active old UI gates                               | Existing `native-site.browser.ts`, `search.browser.ts`; small hosted public check reuses their reader expectations                                                                    |
| Production exact-attempt/history/ZIP/identity/baseline/evidence and cutover                | Retain old-only while callers active; no new replacement requirement | Existing `stage-*.test.ts`, `pages*.test.ts`, `publication.test.ts`, `site-identity.test.ts`, `cutover.test.ts`; original production workflows untouched                              |
| Native Actions/Pages, mode recovery and representative failure                             | #35 bounded integration milestone                                    | Actual isolated runs, remote revisions, public browser observations; not a routine per-PR matrix                                                                                      |
| Sole-chain cutover, production operation, rollback, real production schedule               | #36 after activation decision                                        | Separate production acceptance; #35 cannot mark passed                                                                                                                                |

No old gates/modules are removed or test counts targeted. Additive integration
adds CI cost until migration; no total CI saving is claimed.
