import { inflateRawSync } from "node:zlib";
import { WORKFLOWS, validateRecord, reference } from "./stage-record.js";
import type { Stage, StageRecord, RunReference } from "./stage-record.js";
const MAX_RESPONSE = 2_000_000;
const MAX_RECORD = 64_000;
function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Read a single bounded regular member in memory; never extract artifact paths. */
export function unzipRecord(zip: Buffer, member = "stage.json"): unknown {
  const fail = (): never => {
    throw new Error(
      `Unsafe or malformed stage artifact; expected only bounded regular ${member}`,
    );
  };
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--)
    if (
      zip.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + zip.readUInt16LE(i + 20) === zip.length
    ) {
      end = i;
      break;
    }
  if (end < 0) fail();
  if (
    zip.readUInt16LE(end + 4) ||
    zip.readUInt16LE(end + 6) ||
    zip.readUInt16LE(end + 8) !== 1 ||
    zip.readUInt16LE(end + 10) !== 1
  )
    fail();
  const central = zip.readUInt32LE(end + 16),
    centralSize = zip.readUInt32LE(end + 12);
  if (
    central + centralSize !== end ||
    centralSize < 46 ||
    central + 46 > end ||
    zip.readUInt32LE(central) !== 0x02014b50
  )
    fail();
  const flags = zip.readUInt16LE(central + 8),
    method = zip.readUInt16LE(central + 10),
    crc = zip.readUInt32LE(central + 16);
  const packed = zip.readUInt32LE(central + 20),
    size = zip.readUInt32LE(central + 24);
  const nameLength = zip.readUInt16LE(central + 28),
    extraLength = zip.readUInt16LE(central + 30),
    commentLength = zip.readUInt16LE(central + 32);
  const attrs = zip.readUInt32LE(central + 38),
    offset = zip.readUInt32LE(central + 42);
  const mode = (attrs >>> 16) & 0xf000;
  const name = zip
    .subarray(central + 46, central + 46 + nameLength)
    .toString("utf8");
  if (
    name !== member ||
    centralSize !== 46 + nameLength + extraLength + commentLength ||
    size > MAX_RECORD ||
    packed > MAX_RESPONSE ||
    flags & ~0x808 ||
    ![0, 8].includes(method) ||
    (mode !== 0 && mode !== 0x8000) ||
    attrs & 0x10 ||
    offset !== 0 ||
    zip.readUInt16LE(central + 34)
  )
    fail();
  if (
    central < 30 ||
    zip.readUInt32LE(offset) !== 0x04034b50 ||
    zip.readUInt16LE(6) !== flags ||
    zip.readUInt16LE(8) !== method
  )
    fail();
  const localName = zip.readUInt16LE(26),
    localExtra = zip.readUInt16LE(28);
  const start = 30 + localName + localExtra;
  if (
    zip.subarray(30, 30 + localName).toString("utf8") !== name ||
    start + packed > central
  )
    fail();
  if (
    !(flags & 8) &&
    (zip.readUInt32LE(14) !== crc ||
      zip.readUInt32LE(18) !== packed ||
      zip.readUInt32LE(22) !== size)
  )
    fail();
  const descriptorSize = central - start - packed;
  if (!(flags & 8) && descriptorSize !== 0) fail();
  if (flags & 8) {
    if (![12, 16].includes(descriptorSize)) fail();
    const d = start + packed + (descriptorSize === 16 ? 4 : 0);
    if (
      (descriptorSize === 16 &&
        zip.readUInt32LE(start + packed) !== 0x08074b50) ||
      zip.readUInt32LE(d) !== crc ||
      zip.readUInt32LE(d + 4) !== packed ||
      zip.readUInt32LE(d + 8) !== size
    )
      fail();
  }
  const compressed = zip.subarray(start, start + packed);
  const bytes =
    method === 0
      ? compressed
      : inflateRawSync(compressed, { maxOutputLength: MAX_RECORD });
  if (bytes.length !== size || crc32(bytes) !== crc) fail();
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
export interface ActionsRun {
  id: number;
  run_attempt: number;
  status: string;
  conclusion: string;
  head_branch: string;
  head_sha: string;
  path: string;
  event: string;
  repository: { full_name: string };
  head_repository: { full_name: string };
}
export class ActionsEvidence {
  private readonly base: string;
  constructor(
    readonly repository: string,
    readonly branch: string,
    readonly archiveBranch: string,
    readonly token = process.env.GH_TOKEN ?? "",
    api = process.env.GITHUB_API_URL ?? "https://api.github.com",
  ) {
    const url = new URL(api);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["https:", "http:"].includes(url.protocol)
    )
      throw new Error("Invalid Actions API URL");
    this.base = `${api.replace(/\/$/, "")}/repos/${repository}`;
  }
  async request(path: string, binary = false): Promise<any> {
    let url = this.base + path;
    let authorized = true;
    for (let redirect = 0; redirect <= 5; redirect++) {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(30000),
        headers: {
          Accept: "application/vnd.github+json",
          ...(authorized && this.token
            ? { Authorization: `Bearer ${this.token}` }
            : {}),
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!binary || !location)
          throw new Error("Unexpected Actions API redirect");
        const next = new URL(location, url);
        if (
          !["https:", "http:"].includes(next.protocol) ||
          next.username ||
          next.password ||
          (new URL(url).protocol === "https:" && next.protocol !== "https:")
        )
          throw new Error("Unsafe artifact redirect");
        url = next.href;
        authorized = false;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Actions evidence API HTTP ${response.status}`);
      }
      if (Number(response.headers.get("content-length")) > MAX_RESPONSE) {
        await response.body?.cancel();
        throw new Error("Oversized Actions evidence");
      }
      const chunks: Buffer[] = [];
      let size = 0;
      if (!response.body) throw new Error("Missing Actions evidence body");
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > MAX_RESPONSE) {
          throw new Error("Oversized Actions evidence");
        }
        chunks.push(Buffer.from(chunk));
      }
      const bytes = Buffer.concat(chunks);
      return binary ? bytes : JSON.parse(bytes.toString("utf8"));
    }
    throw new Error("Too many artifact redirects");
  }
  private async trustedRun(
    ref: RunReference,
    stage: Stage,
  ): Promise<ActionsRun> {
    if (!reference(ref))
      throw new Error("Run ID and attempt must be positive integers");
    const run = (await this.request(
      `/actions/runs/${ref.run_id}/attempts/${ref.attempt}`,
    )) as ActionsRun;
    const events =
      stage === "capture"
        ? ["schedule", "workflow_dispatch"]
        : ["workflow_run", "workflow_dispatch"];
    if (
      run.id !== ref.run_id ||
      run.run_attempt !== ref.attempt ||
      run.status !== "completed" ||
      run.conclusion !== "success" ||
      run.head_branch !== this.branch ||
      run.repository?.full_name !== this.repository ||
      run.head_repository?.full_name !== this.repository ||
      run.path?.split("@")[0] !== `.github/workflows/${WORKFLOWS[stage]}` ||
      !events.includes(run.event) ||
      !/^[a-f0-9]{40}$/.test(run.head_sha)
    )
      throw new Error(
        "Upstream is not the exact successful trusted default-branch workflow attempt",
      );
    return run;
  }
  async handoff(ref: RunReference, stage: Stage): Promise<StageRecord> {
    const run = await this.trustedRun(ref, stage);
    const name = `v2-stage-${stage}-${ref.run_id}-${ref.attempt}`;
    const found: any[] = [];
    for (let page = 1; page <= 1000; page++) {
      const data = await this.request(
        `/actions/runs/${ref.run_id}/artifacts?per_page=100&page=${page}`,
      );
      if (!Array.isArray(data.artifacts))
        throw new Error("Malformed artifact listing");
      found.push(...data.artifacts.filter((a: any) => a.name === name));
      if (data.artifacts.length < 100) break;
      if (page === 1000) throw new Error("Artifact pagination limit exceeded");
    }
    if (found.length !== 1 || found[0].expired !== false)
      throw new Error(
        `Missing, expired, or ambiguous exact evidence ${name}; run a fresh stage`,
      );
    const artifact = found[0];
    if (
      !Number.isSafeInteger(artifact.id) ||
      artifact.id < 1 ||
      artifact.workflow_run?.id !== run.id ||
      artifact.workflow_run?.head_sha !== run.head_sha ||
      artifact.workflow_run?.head_branch !== this.branch
    )
      throw new Error("Artifact ownership/revision mismatch");
    const record = unzipRecord(
      await this.request(`/actions/artifacts/${artifact.id}/zip`, true),
    );
    validateRecord(record);
    if (
      record.stage !== stage ||
      record.repository !== this.repository ||
      record.branch !== this.branch ||
      record.archive_branch !== this.archiveBranch ||
      record.run_id !== run.id ||
      record.attempt !== run.run_attempt ||
      record.definition_sha !== run.head_sha
    )
      throw new Error(
        "Handoff repository/stage/branch/run/attempt/definition mismatch",
      );
    if (
      !["changed", "no-change", "superseded", "stage-only"].includes(
        record.outcome,
      )
    )
      throw new Error("Upstream has no successful durable result");
    if (run.event !== "workflow_run") {
      if (record.application_sha !== run.head_sha || record.upstream !== null)
        throw new Error("Manual application or origin contradicts trusted run");
    } else {
      if (!record.upstream)
        throw new Error("Automatic render lacks exact upstream reference");
      const origin = await this.handoff(record.origin, "capture");
      if (
        record.archive_input !== origin.archive_output ||
        record.remote !== origin.remote
      )
        throw new Error(
          "Inherited archive revision/remote contradicts exact capture output",
        );
      if (!origin.eligible && record.outcome !== "stage-only")
        throw new Error("Non-advancing capture cannot authorize render output");
      if (record.application_sha !== origin.application_sha)
        throw new Error(
          "Inherited application contradicts trusted capture origin",
        );
    }
    return record;
  }
}
