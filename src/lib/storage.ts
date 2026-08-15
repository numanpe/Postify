import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";

// Local-disk implementation for Phase 1. Shaped as an interface so a real
// object-storage backend (S3-compatible, etc.) can be swapped in later
// without touching callers — but only this one implementation exists now,
// per "don't over-engineer."
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

export const storage: StorageAdapter = new LocalDiskStorage();

// companyId is always the first path segment so the serving route can
// verify company membership before returning bytes — see
// src/app/api/storage/[...key]/route.ts.
export function buildStorageKey(companyId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${companyId}/${randomUUID()}-${safeName}`;
}
