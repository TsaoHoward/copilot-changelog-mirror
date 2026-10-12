import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { cpSync, symlinkSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { Fixture, root } from "./support.js";

import { fixtureEnvironment } from "./environment-support.js";
const run = promisify(execFile);
export class StageFixture extends Fixture {
  readonly remote = join(this.dir, "remote.git");
  readonly state = join(this.dir, "stage.json");
  constructor(t: TestContext) {
    super(t);
    execFileSync("git", ["init", "--bare", "-q", this.remote]);
    this.git("remote", "add", "origin", this.remote);
    this.git("push", "-q", "origin", "main");
    cpSync(join(root, "src/v2"), join(this.repo, "src/v2"), {
      recursive: true,
    });
    symlinkSync(join(root, "node_modules"), join(this.repo, "node_modules"));
    cpSync(join(root, "package.json"), join(this.repo, "package.json"));
    this.git("add", "src/v2", "package.json");
    this.git("commit", "-qm", "Selected application source");
  }
  remoteTip(branch = this.branch): string | null {
    const value = this.text("ls-remote", "origin", `refs/heads/${branch}`);
    return value ? value.split(/\s/)[0]! : null;
  }
  async stage(
    command: string,
    extra: string[] = [],
    env: NodeJS.ProcessEnv = {},
  ) {
    const log = join(this.dir, "stage-network.log");
    let output;
    try {
      output = {
        code: 0,
        ...(await run(
          process.execPath,
          [
            "--import",
            "tsx",
            join(root, "src/v2/stage-cli.ts"),
            command,
            "--repo",
            this.repo,
            "--definition-repo",
            root,
            "--repository",
            "fixture/archive",
            "--archive-branch",
            this.branch,
            "--state",
            this.state,
            ...extra,
          ],
          {
            cwd: root,
            env: fixtureEnvironment({
              COPILOT_CAPTURE_NOW: "2026-10-06T12:00:00.000Z",
              COPILOT_NETWORK_LOG: log,
              ...env,
            }),
          },
        )),
      };
    } catch (error: any) {
      output = { code: error.code, stdout: error.stdout, stderr: error.stderr };
    }
    assert.equal(
      existsSync(log) ? readFileSync(log, "utf8") : "",
      "",
      "Offline domain subprocess attempted acquisition",
    );
    return {
      ...output,
      result: output.stdout ? JSON.parse(output.stdout) : null,
    };
  }
}

export function artifactZip(
  record: unknown,
  name = "stage.json",
  variant?: "duplicate" | "symlink",
): Buffer {
  const bytes = Buffer.from(
    typeof record === "string" ? record : JSON.stringify(record),
  );
  const packed = deflateRawSync(bytes);
  const filename = Buffer.from(name);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const members: Buffer[] = [],
    directory: Buffer[] = [];
  let offset = 0;
  const count = variant === "duplicate" ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const local = Buffer.alloc(30),
      central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(filename.length, 26);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(
      ((variant === "symlink" ? 0o120777 : 0o100644) << 16) >>> 0,
      38,
    );
    central.writeUInt32LE(offset, 42);
    members.push(local, filename, packed);
    directory.push(central, filename);
    offset += local.length + filename.length + packed.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(Buffer.concat(directory).length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...members, ...directory, end]);
}
export async function evidenceServer(
  t: TestContext,
  record: any,
  overrides: {
    run?: Record<string, unknown>;
    artifacts?: unknown[];
    payload?: Buffer;
    status?: number;
    additional?: any[];
  } = {},
) {
  const { serve } = await import("./support.js");
  const run = {
    id: record.run_id,
    run_attempt: record.attempt,
    status: "completed",
    conclusion: "success",
    head_branch: "main",
    repository: { full_name: "fixture/archive" },
    head_repository: { full_name: "fixture/archive" },
    path: `.github/workflows/v2-${record.stage}.yml`,
    event: "workflow_dispatch",
    head_sha: record.definition_sha,
    ...overrides.run,
  };
  const artifact = {
    id: 12,
    name: `v2-stage-${record.stage}-${record.run_id}-${record.attempt}`,
    expired: false,
    workflow_run: {
      id: record.run_id,
      head_branch: "main",
      head_sha: record.definition_sha,
    },
  };
  const requests: string[] = [];
  const url = await serve(t, (req, res) => {
    requests.push(req.url!);
    if (overrides.status) {
      res.writeHead(overrides.status).end("failure");
      return;
    }
    if (
      req.url ===
      `/repos/fixture/archive/actions/runs/${record.run_id}/attempts/${record.attempt}`
    )
      res.end(JSON.stringify(run));
    else if (
      req.url!.startsWith(
        `/repos/fixture/archive/actions/runs/${record.run_id}/artifacts?`,
      )
    )
      res.end(JSON.stringify({ artifacts: overrides.artifacts ?? [artifact] }));
    else if (req.url === "/repos/fixture/archive/actions/artifacts/12/zip")
      res.end(overrides.payload ?? artifactZip(record));
    else if (
      overrides.additional?.some(
        (item) =>
          req.url ===
          `/repos/fixture/archive/actions/runs/${item.run_id}/attempts/${item.attempt}`,
      )
    ) {
      const item = overrides.additional.find(
        (item) =>
          req.url ===
          `/repos/fixture/archive/actions/runs/${item.run_id}/attempts/${item.attempt}`,
      )!;
      res.end(
        JSON.stringify({
          ...run,
          id: item.run_id,
          run_attempt: item.attempt,
          path: `.github/workflows/v2-${item.stage}.yml`,
          event: "workflow_dispatch",
          head_sha: item.definition_sha,
        }),
      );
    } else if (
      overrides.additional?.some((item) =>
        req.url!.startsWith(
          `/repos/fixture/archive/actions/runs/${item.run_id}/artifacts?`,
        ),
      )
    ) {
      const item = overrides.additional.find((item) =>
        req.url!.startsWith(
          `/repos/fixture/archive/actions/runs/${item.run_id}/artifacts?`,
        ),
      )!;
      res.end(
        JSON.stringify({
          artifacts: [
            {
              ...artifact,
              id: 13,
              name: `v2-stage-${item.stage}-${item.run_id}-${item.attempt}`,
              workflow_run: {
                id: item.run_id,
                head_branch: "main",
                head_sha: item.definition_sha,
              },
            },
          ],
        }),
      );
    } else if (
      req.url === "/repos/fixture/archive/actions/artifacts/13/zip" &&
      overrides.additional?.[0]
    ) {
      res.end(artifactZip(overrides.additional[0]));
    } else {
      res.writeHead(404).end("unknown exact evidence request");
    }
  });
  return { url, requests };
}
