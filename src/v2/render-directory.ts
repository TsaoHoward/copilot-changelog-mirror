import { renderBatch } from "./render-batch.js";
import { DirectoryArchive } from "./directory-archive.js";
import type { DirectoryResult } from "./directory-archive.js";

export async function renderDirectory(options: {
  archiveDir: string;
}): Promise<
  DirectoryResult<{ rendered: number; updated: number; unchanged: number }>
> {
  try {
    const archive = new DirectoryArchive(options.archiveDir);
    const input = await archive.read();
    const candidate = renderBatch(input, true);
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
