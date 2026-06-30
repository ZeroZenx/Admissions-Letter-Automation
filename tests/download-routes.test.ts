import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("download ZIP route rejects partial archives and audits bulk downloads", async () => {
  const source = await readFile("app/api/download-zip/route.ts", "utf8");

  assert.match(source, /generatedLetterIds: z\.array\(z\.string\(\)\.uuid\(\)\)\.min\(1\)/);
  assert.match(source, /One or more generated letters were not found/);
  assert.match(source, /enforceApplicantOwnership/);
  assert.match(source, /letters\.downloaded_zip/);
  assert.match(source, /fileCount: result\.rows\.length/);
});

test("individual download route audits downloads without returning storage paths", async () => {
  const source = await readFile("app/api/download/[id]/route.ts", "utf8");

  assert.match(source, /readStorageBuffer\(key\)/);
  assert.match(source, /letter\.downloaded/);
  assert.match(source, /fileType: type/);
  assert.match(source, /return new NextResponse\(buffer/);
  assert.doesNotMatch(source, /NextResponse\.json\([^)]*storage_key/s);
});
