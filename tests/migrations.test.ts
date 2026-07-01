import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mappableLetterFields } from "../lib/banner-fields";

test("operational integrity migration guards original duplicate sends before Graph delivery", async () => {
  const sql = await readFile("db/migrations/002_operational_integrity.sql", "utf8");

  assert.match(sql, /email_logs_one_original_send_idx/);
  assert.match(sql, /status IN \('pending', 'sent'\) AND resend_reason IS NULL/);
});

test("database setup script includes operational integrity migration", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as { scripts: Record<string, string> };

  assert.match(packageJson.scripts["db:migrate"], /001_initial_schema\.sql/);
  assert.match(packageJson.scripts["db:migrate"], /002_operational_integrity\.sql/);
  assert.match(packageJson.scripts["db:migrate"], /003_app_settings\.sql/);
  assert.match(packageJson.scripts["db:migrate"], /004_query_performance\.sql/);
  assert.match(packageJson.scripts["db:migrate"], /005_field_mapping_integrity\.sql/);
  assert.match(packageJson.scripts["db:migrate"], /006_operational_status_consistency\.sql/);
});

test("query performance migration covers operational dashboard and automation queries", async () => {
  const sql = await readFile("db/migrations/004_query_performance.sql", "utf8");

  assert.match(sql, /applicants_import_valid_idx/);
  assert.match(sql, /generated_letters_generated_at_idx/);
  assert.match(sql, /email_logs_created_at_idx/);
  assert.match(sql, /field_mappings_template_idx/);
});

test("migration runner wraps each SQL file in a transaction", async () => {
  const script = await readFile("scripts/migrate.mjs", "utf8");

  assert.match(script, /await client\.query\("BEGIN"\)/);
  assert.match(script, /await client\.query\("COMMIT"\)/);
  assert.match(script, /await client\.query\("ROLLBACK"\)/);
});

test("field mapping integrity migration enforces canonical Banner fields", async () => {
  const sql = await readFile("db/migrations/005_field_mapping_integrity.sql", "utf8");

  assert.match(sql, /field_mappings_banner_field_chk/);
  assert.match(sql, /invalid banner_field value/);
  for (const field of mappableLetterFields) {
    assert.match(sql, new RegExp(`'${field}'`));
  }
});

test("operational status consistency migration protects automation audit state", async () => {
  const sql = await readFile("db/migrations/006_operational_status_consistency.sql", "utf8");

  assert.match(sql, /imports_counts_consistent_chk/);
  assert.match(sql, /total_rows = valid_rows \+ invalid_rows/);
  assert.match(sql, /generated_letters_status_consistency_chk/);
  assert.match(sql, /status <> 'pdf_generated' OR pdf_storage_key IS NOT NULL/);
  assert.match(sql, /status <> 'failed' OR NULLIF\(trim\(error_message\), ''\) IS NOT NULL/);
  assert.match(sql, /email_logs_status_consistency_chk/);
  assert.match(sql, /status <> 'sent' OR sent_at IS NOT NULL/);
  assert.match(sql, /status <> 'pending' OR sent_at IS NULL/);
});
