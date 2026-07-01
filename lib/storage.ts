import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStorageEnv } from "@/lib/env";

function storageRoot() {
  return path.resolve(getStorageEnv().APP_STORAGE_DIR);
}

export function storagePath(key: string) {
  const root = storageRoot();
  const normalized = normalizeStorageKey(key);
  const absolutePath = path.resolve(root, normalized);
  assertInsideStorageRoot(root, absolutePath);
  return absolutePath;
}

export function storageKeyFromPath(absolutePath: string) {
  const root = storageRoot();
  const resolvedPath = path.resolve(absolutePath);
  assertInsideStorageRoot(root, resolvedPath);
  return path.relative(root, resolvedPath).split(path.sep).join("/");
}

function assertInsideStorageRoot(root: string, absolutePath: string) {
  const relative = path.relative(root, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid storage key.");
  }
}

export async function saveBuffer(area: string, originalName: string, buffer: Buffer) {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${area}/${randomUUID()}-${safeName}`;
  const absolutePath = storagePath(key);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
  return key;
}

export async function readStorageBuffer(key: string) {
  return readFile(storagePath(key));
}

function normalizeStorageKey(key: string) {
  if (key.includes("\0")) throw new Error("Invalid storage key.");
  if (key === "") return "";
  if (path.isAbsolute(key) || path.posix.isAbsolute(key) || path.win32.isAbsolute(key)) {
    throw new Error("Invalid storage key.");
  }

  const parts = key.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.some((part) => part === "..")) {
    throw new Error("Invalid storage key.");
  }
  return parts.join(path.sep);
}
