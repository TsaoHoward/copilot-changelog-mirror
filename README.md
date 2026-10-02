# Copilot Changelog Mirror

A small GitHub Actions workflow and CLI for mirroring public GitHub Copilot Changelog articles. It can capture original article HTML as durable snapshots or convert articles to Markdown on the separate `mirror-data` Git branch. That branch is created as an orphan on the first run, so it contains archive content without the application files from `main`.

## Requirements

- Python 3.11 or newer
- Git, with an author name and email configured for commits

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then sync the project and its development tools from the repository root:

```sh
uv sync
```

Capture source HTML without article parsing or publishing:

```sh
uv run copilot-mirror capture
```

The capture command reads `https://github.blog/changelog/label/copilot/feed/` by default, saves each response byte-for-byte under `snapshots/`, and records the source URL and UTC fetch time in a neighboring JSON file. Snapshot paths are derived from each source URL. Identical HTML leaves both snapshot and provenance unchanged; changed HTML updates the same path, preserving earlier versions in Git history. Capture leaves the checked-out application branch and existing `posts/` untouched.

The original Markdown archive command remains available for local parser work:

```sh
uv run copilot-mirror
```

It writes derived Markdown files under `posts/` on `mirror-data` and leaves the checked-out application branch unchanged.

For local fixture runs, pass an RSS file URL and optionally a repository path:

```sh
uv run copilot-mirror --feed-url file:///path/to/feed.xml --repo /path/to/git-checkout
```

Both commands use the official RSS feed for discovery. The Markdown archive records publication time when the feed provides one and fetch time for every generated post.

Run the behavior tests with:

```sh
uv run ruff check .
uv run ruff format --check .
uv run python -m unittest discover -s tests -v
```

## GitHub Pages

The `Capture Copilot Changelog snapshots` workflow captures and pushes raw snapshots at 06:17 and 12:17 in the `Asia/Taipei` timezone. It can also be started manually. It has no parsing or Pages dependency. The workflow fetches existing `mirror-data` history when that branch is present; on the first run, it creates the branch and pushes it.

The `Publish archive to GitHub Pages` workflow remains available as an independent manual Pages-only recovery path. It builds the Jekyll site from `main` and the Markdown posts on `mirror-data`. The remote `mirror-data` branch must exist before this Pages-only workflow can publish. To bootstrap it manually, run the Markdown archive command once from a checkout and push its new branch:

```sh
uv run copilot-mirror
git push origin mirror-data
```

Then set the repository's Pages build and deployment source to **GitHub Actions** under **Settings → Pages**, and run the workflow from **Actions → Publish archive to GitHub Pages → Run workflow**.
