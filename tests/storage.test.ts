import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { saveBuffer, storageKeyFromPath, storagePath } from "../lib/storage";

function storageTestRoot() {
  return path.join(tmpdir(), "costaatt-storage-test-root");
}

test("storagePath keeps valid keys inside APP_STORAGE_DIR", () => {
  process.env.APP_STORAGE_DIR = storageTestRoot();

  const resolved = storagePath("generated/example.docx");

  assert.equal(resolved, path.join(storageTestRoot(), "generated", "example.docx"));
});

test("storagePath rejects traversal and absolute keys", () => {
  process.env.APP_STORAGE_DIR = storageTestRoot();

  assert.throws(() => storagePath("../outside.docx"), /Invalid storage key/);
  assert.throws(() => storagePath("generated/../../outside.docx"), /Invalid storage key/);
  assert.throws(() => storagePath("/tmp/outside.docx"), /Invalid storage key/);
  assert.throws(() => storagePath("C:\\outside.docx"), /Invalid storage key/);
  assert.throws(() => storagePath("generated\u0000bad.docx"), /Invalid storage key/);
});

test("storageKeyFromPath returns portable keys for files inside storage", () => {
  process.env.APP_STORAGE_DIR = storageTestRoot();

  const key = storageKeyFromPath(path.join(storageTestRoot(), "generated", "example.pdf"));

  assert.equal(key, "generated/example.pdf");
});

test("storageKeyFromPath rejects paths outside APP_STORAGE_DIR", () => {
  process.env.APP_STORAGE_DIR = storageTestRoot();

  assert.throws(() => storageKeyFromPath(path.join(process.cwd(), "outside.pdf")), /Invalid storage key/);
});

test("saveBuffer returns portable storage keys", async () => {
  process.env.APP_STORAGE_DIR = await mkdtemp(path.join(tmpdir(), "costaatt-storage-"));

  const key = await saveBuffer("generated", "student letter.docx", Buffer.from("ok"));

  assert.match(key, /^generated\/[a-f0-9-]+-student_letter\.docx$/);
  assert.equal(key.includes("\\"), false);
});
