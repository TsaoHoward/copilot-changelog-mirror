import { GitArchive } from "./archive.js";
import { captureBatch } from "./capture-batch.js";

export interface CaptureOptions {
  repo: string;
  branch: string;
  feedUrl: string;
  timeoutMs?: number;
  now?: () => Date;
}
export interface CaptureSuccess {
  outcome: "changed" | "no-change";
  archive_input: string | null;
  archive_output: string;
  counts: { created: number; updated: number; unchanged: number };
}
export interface CaptureFailure {
  outcome: "failure";
  archive_input: string | null;
  archive_output: null;
  diagnostic: string;
}
export type CaptureResult = CaptureSuccess | CaptureFailure;

export async function capture(options: CaptureOptions): Promise<CaptureResult> {
  let archive_input: string | null = null;
  try {
    const archive = new GitArchive(options.repo, options.branch);
    const input = archive.read();
    archive_input = input.revision;
    const { files, counts, changed } = await captureBatch(input, options);
    const output = changed
      ? await archive.commit(input, files)
      : input.revision!;
    return {
      outcome: changed ? "changed" : "no-change",
      archive_input,
      archive_output: output,
      counts,
    };
  } catch (error) {
    return {
      outcome: "failure",
      archive_input,
      archive_output: null,
      diagnostic: error instanceof Error ? error.message : String(error),
    };
  }
}
