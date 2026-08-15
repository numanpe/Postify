import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { put as blobPut, get as blobGet, del as blobDel } from "@vercel/blob";

// Local-disk implementation for Phase 1, later joined by a Vercel Blob
// implementation once the app was actually deployed (Phase 6 verification
// found Vercel Functions run on a read-only filesystem outside /tmp, so
// local-disk storage silently can't work there). Shaped as an interface
// so either backend — or a future S3-compatible one — is a drop-in swap
// for callers.
export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  url(key: string): string;
}

const STORAGE_ROOT = path.join(process.cwd(), "storage", "local");

function resolvePath(key: string): string {
  const resolved = path.join(STORAGE_ROOT, key);
  if (!resolved.startsWith(STORAGE_ROOT + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

class LocalDiskStorage implements StorageAdapter {
  async put(key: string, data: Buffer): Promise<void> {
    const filePath = resolvePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(resolvePath(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(resolvePath(key), { force: true });
  }

  url(key: string): string {
    return `/api/storage/${key}`;
  }
}

// Blobs are private (never publicly fetchable by URL) and keep a
// deterministic pathname (addRandomSuffix: false) so `key` alone — the
// same value stored in MediaAsset.storageKey — is always enough to
// get/delete it later, exactly like the local-disk implementation.
// Serving still goes through the authenticated /api/storage/[...key]
// route, never a direct Blob URL — see PublicAssetLink in
// prisma/schema.prisma for the one deliberate, narrow exception to that.
class VercelBlobStorage implements StorageAdapter {
  async put(key: string, data: Buffer): Promise<void> {
    await blobPut(key, data, { access: "private", addRandomSuffix: false });
  }

  async get(key: string): Promise<Buffer> {
    const result = await blobGet(key, { access: "private" });
    if (!result) {
      throw new Error(`Blob not found: ${key}`);
    }
    const arrayBuffer = await new Response(result.stream).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(key: string): Promise<void> {
    await blobDel(key);
  }

  url(key: string): string {
    return `/api/storage/${key}`;
  }
}

// process.env.VERCEL (set to "1" on every Vercel deployment and by
// `vercel dev`, never by plain `next dev`) — not the presence of
// BLOB_READ_WRITE_TOKEN — decides the backend, so pulling Vercel env
// vars into local dev (e.g. via `vercel env pull`) can't accidentally
// switch local dev off the disk-based adapter.
export const storage: StorageAdapter = process.env.VERCEL
  ? new VercelBlobStorage()
  : new LocalDiskStorage();

// companyId is always the first path segment so the serving route can
// verify company membership before returning bytes — see
// src/app/api/storage/[...key]/route.ts.
export function buildStorageKey(companyId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${companyId}/${randomUUID()}-${safeName}`;
}
