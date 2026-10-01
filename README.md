# Copilot Changelog Mirror

A small GitHub Actions workflow and CLI for mirroring public GitHub Copilot Changelog articles. It reads the official RSS feed, fetches each linked article, converts its article body to Markdown, and commits the archive to the separate `mirror-data` Git branch. The branch is created as an orphan on the first run, so it contains archive content without the application files from `main`.

## Requirements

- Python 3.11 or newer
- Git, with an author name and email configured for commits

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then sync the project and its development tools from the repository root:

```sh
uv sync
```

Run the mirror manually from the Git checkout:

```sh
uv run copilot-mirror
```

The command reads `https://github.blog/changelog/label/copilot/feed/` by default, writes Markdown files under `posts/` on `mirror-data`, and leaves the checked-out application branch unchanged. Re-running it keeps unchanged posts and the branch commit unchanged; changed source content updates the archive branch.

For local fixture runs, pass an RSS file URL and optionally a repository path:

```sh
uv run copilot-mirror --feed-url file:///path/to/feed.xml --repo /path/to/git-checkout
```

The RSS feed's article links are fetched as-is. Publication time is recorded when the feed provides one; fetch time is recorded for every archived article.

Run the behavior tests with:

```sh
uv run ruff check .
uv run ruff format --check .
uv run python -m unittest discover -s tests -v
```

## GitHub Pages

The `Mirror and publish Copilot Changelog` workflow runs the mirror and publishes the site at 06:17 and 12:17 in the `Asia/Taipei` timezone. It can also be started manually to run the same end-to-end flow. The workflow fetches the existing `mirror-data` history, runs the mirror, pushes the archive branch, and then calls the Pages build and deployment workflow.

The `Publish archive to GitHub Pages` workflow remains available as a manual Pages-only recovery path. It builds the Jekyll site from `main` and the Markdown posts on `mirror-data`. The remote `mirror-data` branch must exist before it can publish. For the first publication, run the mirror once from a checkout and push its new branch:

```sh
uv run copilot-mirror
git push origin mirror-data
```

Then set the repository's Pages build and deployment source to **GitHub Actions** under **Settings → Pages**, and run the workflow from **Actions → Publish archive to GitHub Pages → Run workflow**.
