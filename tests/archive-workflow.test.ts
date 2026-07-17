import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("archive migration preserves batches and records encrypted sender configuration", async () => {
  const migration = await readFile("db/migrations/016_sender_and_archiving.sql", "utf8");
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.match(migration, /archived_at timestamptz/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS email_sender_settings/);
  assert.match(migration, /password_encrypted text/);
  assert.match(packageJson.scripts["db:migrate"], /016_sender_and_archiving\.sql/);
});

test("active operational APIs hide archived import batches", async () => {
  for (const file of [
    "app/api/applicants/route.ts",
    "app/api/generated-letters/route.ts",
    "app/api/email-logs/route.ts",
    "app/api/generate-letter/route.ts",
    "app/api/send-email/route.ts"
  ]) {
    assert.match(await readFile(file, "utf8"), /archived_at IS NULL/, file);
  }
});

test("permanent clear requires an archived batch and Admin role", async () => {
  const source = await readFile("app/api/imports/[id]/route.ts", "utf8");
  assert.match(source, /requireAuth\(request, \["Admin"\]\)/);
  assert.match(source, /WHERE i\.id = \$1 AND i\.archived_at IS NOT NULL/);
  assert.match(source, /DELETE FROM imports WHERE id = \$1 AND archived_at IS NOT NULL/);
  assert.match(source, /audit\("import\.cleared"/);
});
