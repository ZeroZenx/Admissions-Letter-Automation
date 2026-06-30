import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("operational integrity migration guards original duplicate sends before Graph delivery", async () => {
  const sql = await readFile("db/migrations/002_operational_integrity.sql", "utf8");

  assert.match(sql, /email_logs_one_original_send_idx/);
  assert.match(sql, /status IN \('pending', 'sent'\) AND resend_reason IS NULL/);
});

test("database setup script includes operational integrity migration", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as { scripts: Record<string, string> };

  assert.match(packageJson.scripts["db:migrate"], /001_initial_schema\.sql/);
  assert.match(packageJson.scripts["db:migrate"], /002_operational_integrity\.sql/);
});
