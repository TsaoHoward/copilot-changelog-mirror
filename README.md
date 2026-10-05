# Copilot Changelog Mirror

A CLI and independent GitHub Actions workflows for mirroring public GitHub Copilot Changelog articles. Capture saves original article HTML as durable snapshots; render derives Markdown from those saved bytes on the separate `mirror-data` Git branch. Capture creates that branch as an orphan on the first run, so it contains archive content without the application files from `main`.

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

The `Capture Copilot Changelog snapshots` workflow captures and pushes raw snapshots at 06:17 and 12:17 in the `Asia/Taipei` timezone. It can also be started manually. It has no parsing or Pages dependency. The workflow fetches existing `mirror-data` history when that branch is present; on the first run, it creates the branch and pushes it.

The `Render archive posts from snapshots` workflow is manual and fetches existing `mirror-data` history, installs locked Python dependencies, renders saved snapshots, and ordinarily pushes the archive branch. Missing history, render errors, and competing updates fail visibly. Render has no schedule and invokes neither capture nor Pages.

The `Publish archive to GitHub Pages` workflow is an independent manual publication operation. It builds the Jekyll site from `main` and the Markdown posts on `mirror-data`. The manual production sequence is **Capture snapshots → Render archive posts → Publish archive to GitHub Pages**. Each workflow must be started separately.

To bootstrap the archive locally, acquire source, derive posts, and push the archive:

```sh
uv run copilot-mirror capture
uv run copilot-mirror render
git push origin mirror-data
```

Then set the repository's Pages build and deployment source to **GitHub Actions** under **Settings → Pages**, and run the workflow from **Actions → Publish archive to GitHub Pages → Run workflow**.

Before publishing the first repairs from issue #13, complete the production verification in [docs/render-verification.md](docs/render-verification.md).
