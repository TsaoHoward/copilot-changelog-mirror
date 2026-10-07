import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  readManifest,
  validateArchive,
  publicationProjection,
} from "./domain.js";
import type { ArchiveFiles, PublicationProjection } from "./domain.js";

/** A selected checkout/export is read once; no moving Git ref participates. */
export async function loadSitePublication(
  directory: string,
): Promise<PublicationProjection> {
  const files: ArchiveFiles = new Map();
  if (!(await lstat(directory)).isDirectory())
    throw new Error("Archive input must be a directory");
  async function walk(relative = "") {
    for (const name of (await readdir(join(directory, relative))).sort()) {
      if (!relative && name === ".git") continue;
      const path = relative ? `${relative}/${name}` : name;
      const info = await lstat(join(directory, path));
      if (info.isDirectory()) {
        if (path !== "posts" && path !== "snapshots")
          throw new Error(`Invalid archive directory: ${path}`);
        await walk(path);
      } else if (info.isFile()) {
        files.set(path, {
          mode: info.mode & 0o111 ? "100755" : "100644",
          bytes: await readFile(join(directory, path)),
        });
      } else throw new Error(`Archive object must be a regular file: ${path}`);
    }
  }
  await walk();
  const metadata = files.get("metadata.json");
  if (!metadata)
    throw new Error(
      "Selected archive lacks v2 metadata.json; render a v2 archive first",
    );
  const manifest = readManifest(metadata.bytes);
  validateArchive(manifest, files);
  const bodies = new Map<string, string>();
  for (const id of Object.keys(manifest.articles)) {
    const file = files.get(`posts/${id}.md`);
    if (file)
      bodies.set(
        id,
        new TextDecoder("utf-8", { fatal: true }).decode(file.bytes),
      );
  }
  const projection = publicationProjection(manifest, bodies);
  if (projection === null)
    throw new Error(
      "Incomplete canonical publication: every article needs canonical metadata and a joined Markdown body; run offline render first",
    );
  return projection;
}
