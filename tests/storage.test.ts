import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { storagePath } from "../lib/storage";

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
