import { captureBatch } from "./capture-batch.js";
import { DirectoryArchive } from "./directory-archive.js";
import type { DirectoryResult } from "./directory-archive.js";

export async function captureDirectory(options: {
  archiveDir: string;
  feedUrl: string;
  timeoutMs?: number;
  now?: () => Date;
}): Promise<
  DirectoryResult<{ created: number; updated: number; unchanged: number }>
> {
  try {
    const archive = new DirectoryArchive(options.archiveDir);
    const input = await archive.read(true);
    const candidate = await captureBatch(input, options);
    await archive.promote(input, candidate);
    return {
      outcome: candidate.changed ? "changed" : "no-change",
      counts: candidate.counts,
    };
  } catch (error) {
    return {
      outcome: "failure",
      diagnostic: error instanceof Error ? error.message : String(error),
    };
  }
}
