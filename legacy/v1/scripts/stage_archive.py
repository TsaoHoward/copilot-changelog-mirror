"""Stage the mirror-data posts directory as the Jekyll archive collection."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


def stage_archive(source: Path, destination: Path) -> None:
    if not source.is_dir():
        raise SystemExit(f"Archive posts directory does not exist: {source}")
    posts = sorted(source.glob("*.md"))
    if not posts:
        raise SystemExit(f"No Markdown posts found in archive directory: {source}")

    destination.mkdir(parents=True, exist_ok=True)
    for post in posts:
        shutil.copy2(post, destination / post.name)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="mirror-data posts directory")
    parser.add_argument("destination", type=Path, help="Jekyll _archive collection directory")
    args = parser.parse_args()
    stage_archive(args.source, args.destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
