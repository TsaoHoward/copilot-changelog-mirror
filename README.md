# Copilot Changelog Mirror

A small, manually run mirror of public GitHub Copilot Changelog articles. It reads the official RSS feed, fetches each linked article, converts its article body to Markdown, and commits the archive to the separate `mirror-data` Git branch. The branch is created as an orphan on the first run, so it contains archive content without the application files from `main`.

## Requirements

- Python 3.11 or newer
- Git, with an author name and email configured for commits

Install the command from the repository root:

```sh
python -m pip install -e .
```

Run the mirror manually from the Git checkout:

```sh
copilot-mirror
```

The command reads `https://github.blog/changelog/label/copilot/feed/` by default, writes Markdown files under `posts/` on `mirror-data`, and leaves the checked-out application branch unchanged. Re-running it keeps unchanged posts and the branch commit unchanged; changed source content updates the archive branch.

For local fixture runs, pass an RSS file URL and optionally a repository path:

```sh
copilot-mirror --feed-url file:///path/to/feed.xml --repo /path/to/git-checkout
```

The RSS feed's article links are fetched as-is. Publication time is recorded when the feed provides one; fetch time is recorded for every archived article.

Run the behavior tests with:

```sh
python -m unittest discover -s tests -v
```
