# Copilot Changelog Mirror

A CLI and three GitHub Actions workflows for mirroring public GitHub Copilot Changelog articles. Capture saves original article HTML as durable snapshots; render derives Markdown from those saved bytes on the separate `mirror-data` Git branch. Production automatically advances successful stages while retaining independent manual recovery. Capture creates that branch as an orphan on the first run, so it contains archive content without the application files from `main`.

## TypeScript v2 capture and offline render

The new v2 capture path uses Node.js 22.22.x (the exact development/CI version is in `.node-version`). Install its locked dependencies, then capture into a fresh isolated archive branch while production `mirror-data` still contains v1 state:

```sh
npm ci
npm run --silent capture -- --data-branch mirror-data-v2
npm run --silent render -- --data-branch mirror-data-v2
```

Capture preserves raw response bytes in `snapshots/<article_id>.html` and acquisition observations in one validated `metadata.json`. It returns JSON with `changed`, `no-change`, or `failure`, archive revisions, and article counts. The shared API keeps identity immutable and capture/render ownership separate; an identical acquisition creates no commit. Application work and rendered canonical state are preserved.

Render regenerates body-only Markdown and canonical metadata from persisted evidence with source network access disabled. It reports archive changes separately from canonical publication identity: page chrome and unused discovery changes can preserve publication identity even when capture created a new evidence revision. Missing derived bodies repair offline; invalid evidence, conflicting associated dates, and route collisions fail the entire batch.

See [the v2 command and shared archive contract](docs/v2-archive.md) for fixture acquisition, validation rules, API usage, and verification commands. The Python/Jekyll commands and production workflows below remain the v1 path until coordinated cutover.

## Requirements

- Python 3.11 or newer
- Git, with an author name and email configured for commits

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then sync the project and its development tools from the repository root:

```sh
uv sync
```

Capture source HTML without article parsing or publishing:

```sh
python3 src/copilot_mirror.py capture
```

The capture command uses only Python's standard library and Git. It reads `https://github.blog/changelog/label/copilot/feed/` by default, saves each response byte-for-byte under `snapshots/`, and records the source URL, UTC fetch time, discovery title, and optional publication time in a neighboring JSON file. Snapshot paths are derived from each source URL. Identical HTML leaves both snapshot and provenance unchanged, including older provenance records; changed HTML updates the same path, preserving earlier versions in Git history. Capture leaves the checked-out application branch and existing `posts/` untouched.

Render all saved snapshots without fetching a feed or any article pages:

```sh
uv run copilot-mirror render
```

Render requires an existing archive with HTML snapshots and paired JSON provenance. It writes or repairs matching `posts/*.md` files using their established source-URL-derived names, preserving unrelated posts, source files, and Git history. The application branch, HEAD, and local work remain unchanged. Identical output creates no commit; changed output creates one derived-post commit. Invalid provenance, conflicting publication dates, or colliding post identities fail the batch before any post commit. A bare invocation requires an explicit command.

For local fixture acquisition, pass an RSS file URL and optionally a repository path. Both commands accept `--repo` and `--data-branch` (default: `mirror-data`); only capture accepts `--feed-url`:

```sh
uv run copilot-mirror capture --feed-url file:///path/to/feed.xml --repo /path/to/git-checkout
uv run copilot-mirror render --repo /path/to/git-checkout
```

Posts retain the exact saved source URL and fetch timestamp. The canonical title comes from saved HTML, with the discovery title or source URL as a deterministic fallback. A valid saved publication time takes precedence. For older snapshots, render recovers `datePublished` from article-associated structured metadata in saved HTML, normalizing equivalent timezone offsets to UTC. If no valid saved publication time exists, the optional field is omitted. Existing derived posts are never the source of title or publication metadata.

Run the behavior tests with:

```sh
uv run ruff check .
uv run ruff format --check .
uv run python -m unittest discover -s tests -v
```

## GitHub Pages

The production sequence is **Capture snapshots → Render archive posts → Publish archive to GitHub Pages**, with each stage appearing as a separate Actions run. Capture commits and ordinarily pushes raw snapshots before render can begin. Render consumes that exact persisted revision offline, then commits and pushes posts before Pages can build and deploy. Failed stages stop advancement while preserving earlier remote commits.

`Capture Copilot Changelog snapshots` retains its schedule at **06:17 and 12:17 Asia/Taipei**. Scheduled capture and default manual capture advance the chain; manual `advance=false` captures only. `Render archive posts from snapshots` defaults to render-only; `advance=true` resumes through Pages. Pages can be started independently from verified successful render evidence. Render and Pages have no independent schedules.

All production operations run on the default branch and share a non-cancelling concurrency queue. Exact run/attempt artifacts carry application and archive SHAs between stages. Outdated archive handoffs are explicitly superseded. Unchanged captures and renders still advance to recover unfinished downstream work; equivalent posts and site/build inputs skip deployment only after a verified successful publication. See [production orchestration and recovery](docs/production-orchestration.md) for manual modes, evidence retention, retry commands, and hosted verification.

To bootstrap the archive locally, acquire source, derive posts, and push the archive:

```sh
uv run copilot-mirror capture
uv run copilot-mirror render
git push origin mirror-data
```

Then set the repository's Pages build and deployment source to **GitHub Actions** under **Settings → Pages**, and run the workflow from **Actions → Publish archive to GitHub Pages → Run workflow**.

Before publishing the first repairs from issue #13, complete the production verification in [docs/render-verification.md](docs/render-verification.md).
