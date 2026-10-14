# Directory Capture and offline Render

Issue #33 adds `capture:directory` and `render:directory` alongside the production
commands. Each command handles one stage and writes validated archive files.
The operator owns Git commits and pushes. Existing production workflows,
checkpoint refs, archive writer and site deployment retain their current entry
points and behavior.

Use Node from `.node-version` and `npm ci` in the application checkout. Both
commands require `--archive-dir PATH`. The target must be the root of a clean,
non-bare dedicated Git checkout on `mirror-data-v2`, distinct from the default
branch and disjoint from the application checkout. Detached, dirty (including
untracked/ignored files), application/legacy, unsafe and symlink targets fail.
Inherited Git environment overrides cannot redirect inspection; optional Git
index refresh writes are disabled. Commands never switch branches or create,
commit, push, fetch, reset, rebase or reconcile Git state.

Prepare an archive checkout yourself, for example:

```sh
application=/absolute/path/copilot-changelog-mirror
archive=/absolute/path/copilot-archive
remote=https://github.com/OWNER/ARCHIVE.git

git clone --single-branch --branch mirror-data-v2 "$remote" "$archive"
```

For an intentionally new archive, instead prepare an empty dedicated repository
with ordinary `git init -b mirror-data-v2`, configure its author and remote, and
optionally create an empty initial commit. Capture initializes `metadata.json`
only when the checkout contains no archive files. Render requires a persisted
valid schema-2 manifest; a valid empty archive is supported.

## Full update with two persistence points

Run this sequence from the application checkout after selecting the paths above.
Inspect each successful output before adding it. `git add -A` here is scoped to
the dedicated archive, which the stage required to be clean at entry.

```sh
cd "$application" || exit 1
npm run capture:directory -- --archive-dir "$archive" || exit 1
# Inspect metadata and saved snapshots before continuing.
git -C "$archive" diff --stat
git -C "$archive" status --short
git -C "$archive" add -A || exit 1
if ! git -C "$archive" diff --cached --quiet; then
  git -C "$archive" commit -m 'Capture raw source evidence' || exit 1
fi
git -C "$archive" push origin HEAD:mirror-data-v2 || exit 1

# Invoke Render only after Capture's push has succeeded.
npm run render:directory -- --archive-dir "$archive" || exit 1
# Inspect canonical metadata and body-only Markdown before continuing.
git -C "$archive" diff --stat
git -C "$archive" status --short
git -C "$archive" add -A || exit 1
if ! git -C "$archive" diff --cached --quiet; then
  git -C "$archive" commit -m 'Render canonical article content' || exit 1
fi
git -C "$archive" push origin HEAD:mirror-data-v2 || exit 1
```

A no-change stage needs no empty commit. A successful no-change Capture also
permits running Render independently to repair derived output. A failed or
uncertain Capture push stops this full-update sequence before Render: inspect
the remote before retrying. Ordinary non-fast-forward push rejection preserves
a competing writer's history. Never force-push or automatically reset/rebase to
resolve it. Render can be run independently against a clean saved Capture
checkout, including when the original feed, articles or media are unavailable.

## Stage contracts and failures

Capture accepts `--feed-url URL` and a positive integer `--timeout-ms MS`
(default 30000). Its default feed matches production. It preserves original
acquired snapshot bytes and discovery identity across redirects, retains older
articles, and changes only raw snapshots and capture observations. Unchanged
bytes retain `observed_at`, including discovery-only changes. Identical evidence
preserves existing manifest formatting. Canonical records and existing posts
remain intact. New identities begin with null canonical state; conflicting
source-derived routes reject the complete batch immediately.

Render accepts no acquisition options. It derives every article from saved
snapshots and discovery evidence using strict UTF-8 decoding. Title authority is
article H1, page H1, discovery title, then source URL. Associated structured
`datePublished` takes precedence over discovery publication time; equivalent
instants agree, conflicting valid instants fail. It preserves editorial order,
media references and section links, excludes known chrome, and rejects layouts
without a recognized usable editorial body. Render writes canonical metadata
and body-only posts, preserving identity, snapshots and all capture observations.
Missing derived bodies are regenerated; raw-only semantic-equivalent evidence
changes yield no-change canonical output.

Each CLI prints one JSON result: `outcome` is `changed`, `no-change`, or `failure`.
Success includes Capture `{created, updated, unchanged}` or Render
`{rendered, updated, unchanged}` counts. Failure includes `diagnostic`, also
printed to stderr, and a nonzero exit status. Success describes validated
directory output only; it does not imply a commit, push or deployment.

Inputs, complete candidates, ownership, paths, hashes and routes are validated
before promotion. Target safety is rechecked before any archive output is
installed. Acquisition/normalization/validation failures leave the target
unchanged. Filesystem completion failures return nonzero without a success
claim. They may leave a **dirty disposable checkout** after partial installation;
Git HEAD, index, refs and remote data remain untouched by the commands. Do not
commit/push that failed stage. Keep the saved revision and prepare a fresh
dedicated checkout from it; transparent rollback and crash recovery are not
provided. This is a dedicated single-writer contract, not a general lock protocol.

The local acceptance test uses only disposable checkouts and bare remotes. It
pushes Capture C before a late unsupported-layout Render failure, verifies C's
raw blobs remotely, applies a test-only renderer repair and rerenders C offline,
then separately commits and pushes R descending from C. It also demonstrates
late acquisition/collision rejection, preserved user work, non-fast-forward
rejection and a partial filesystem promotion failure that prevents caller
persistence. It does not exercise or change the live writer or public site.

See [test reassessment and measurements](v2-directory-tests.md) for fixture
provenance, old-gate dispositions and the one-time migration comparison.
