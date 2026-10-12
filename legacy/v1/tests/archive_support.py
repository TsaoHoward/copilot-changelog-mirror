"""Temporary Git archive and offline subprocess CLI acceptance support."""

import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True).stdout


def initialize_repository(repo):
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main")
    git(repo, "config", "user.name", "Fixture User")
    git(repo, "config", "user.email", "fixture@example.invalid")
    (repo / "README.md").write_text("Application checkout.\n")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "Application source")


def offline_cli(repo, *arguments):
    guard = repo.parent / "network-guard"
    guard.mkdir(exist_ok=True)
    marker = guard / "attempted"
    marker.unlink(missing_ok=True)
    (guard / "sitecustomize.py").write_text(
        "import os, sys\n"
        "def reject_network(event, args):\n"
        "    if event in {'socket.connect', 'socket.getaddrinfo', 'urllib.Request'}:\n"
        "        with open(os.environ['NETWORK_ATTEMPT'], 'w') as marker:\n"
        "            marker.write(event)\n"
        "        raise RuntimeError('Network access forbidden in offline render test')\n"
        "sys.addaudithook(reject_network)\n"
    )
    result = subprocess.run(
        [sys.executable, "-m", "copilot_mirror", *arguments, "--repo", str(repo)],
        cwd=PROJECT_ROOT,
        env={
            **os.environ,
            "PYTHONPATH": os.pathsep.join((str(guard), str(PROJECT_ROOT / "src"))),
            "NETWORK_ATTEMPT": str(marker),
        },
        capture_output=True,
        text=True,
    )
    if marker.exists():
        raise AssertionError(f"CLI attempted network access: {marker.read_text()}")
    return result
