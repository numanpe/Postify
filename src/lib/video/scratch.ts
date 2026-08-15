import "server-only";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// One temp directory per render, cleaned up unconditionally (success
// or failure) so a crashed render doesn't leak disk space over time.
export async function withScratchDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "postify-video-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function writeScratchFile(dir: string, name: string, data: Buffer): Promise<string> {
  const filePath = path.join(dir, name);
  await writeFile(filePath, data);
  return filePath;
}
