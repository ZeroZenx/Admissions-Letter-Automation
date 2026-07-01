import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { storageKeyFromPath, storagePath } from "../lib/storage";

test("storagePath keeps valid keys inside APP_STORAGE_DIR", () => {
  process.env.APP_STORAGE_DIR = path.join(process.cwd(), "storage-test-root");

  const resolved = storagePath("generated/example.docx");

  assert.equal(resolved, path.join(process.cwd(), "storage-test-root", "generated", "example.docx"));
});

test("storagePath rejects traversal and absolute keys", () => {
  process.env.APP_STORAGE_DIR = path.join(process.cwd(), "storage-test-root");

  assert.throws(() => storagePath("../outside.docx"), /Invalid storage key/);
  assert.throws(() => storagePath("generated/../../outside.docx"), /Invalid storage key/);
  assert.throws(() => storagePath("/tmp/outside.docx"), /Invalid storage key/);
  assert.throws(() => storagePath("C:\\outside.docx"), /Invalid storage key/);
  assert.throws(() => storagePath("generated\u0000bad.docx"), /Invalid storage key/);
});

test("storageKeyFromPath returns portable keys for files inside storage", () => {
  process.env.APP_STORAGE_DIR = path.join(process.cwd(), "storage-test-root");

  const key = storageKeyFromPath(path.join(process.cwd(), "storage-test-root", "generated", "example.pdf"));

  assert.equal(key, "generated/example.pdf");
});

test("storageKeyFromPath rejects paths outside APP_STORAGE_DIR", () => {
  process.env.APP_STORAGE_DIR = path.join(process.cwd(), "storage-test-root");

  assert.throws(() => storageKeyFromPath(path.join(process.cwd(), "outside.pdf")), /Invalid storage key/);
});
