import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getServerEnv } from "@/lib/env";

function storageRoot() {
  return path.resolve(getServerEnv().APP_STORAGE_DIR);
}

export function storagePath(key: string) {
  const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(storageRoot(), normalized);
}

export async function saveBuffer(area: string, originalName: string, buffer: Buffer) {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = path.join(area, `${randomUUID()}-${safeName}`);
  const absolutePath = storagePath(key);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
  return key;
}

export async function readStorageBuffer(key: string) {
  return readFile(storagePath(key));
}
