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
  assert.match(packageJson.scripts["db:migrate"], /007_template_type_integrity\.sql/);
  assert.match(packageJson.scripts["db:migrate"], /008_storage_key_integrity\.sql/);
  assert.match(packageJson.scripts["db:migrate"], /009_applicant_duplicate_send_integrity\.sql/);
  assert.match(packageJson.scripts["db:migrate"], /010_applicant_status_consistency\.sql/);
  assert.match(packageJson.scripts["db:migrate"], /011_template_name_integrity\.sql/);
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

test("template type integrity migration keeps Banner and template codes aligned", async () => {
  const sql = await readFile("db/migrations/007_template_type_integrity.sql", "utf8");

  assert.match(sql, /templates_template_type_code_chk/);
  assert.match(sql, /applicants_template_type_code_chk/);
  assert.match(sql, /\^\[A-Z0-9_-\]\{1,80\}\$/);
  assert.match(sql, /invalid template_type value/);
});

test("storage key integrity migration rejects unsafe persisted file keys", async () => {
  const sql = await readFile("db/migrations/008_storage_key_integrity.sql", "utf8");

  assert.match(sql, /CREATE OR REPLACE FUNCTION is_safe_storage_key/);
  assert.match(sql, /templates_storage_key_safe_chk/);
  assert.match(sql, /generated_letters_storage_keys_safe_chk/);
  assert.match(sql, /\(\^|\/\)\\\.\\\.\(\/|\$\)/);
  assert.match(sql, /\^\[A-Za-z\]:/);
  assert.match(sql, /position\(E'\\\\' in value\) = 0/);
});

test("applicant duplicate send migration blocks regenerated-letter duplicates", async () => {
  const sql = await readFile("db/migrations/009_applicant_duplicate_send_integrity.sql", "utf8");

  assert.match(sql, /email_logs_one_original_applicant_send_idx/);
  assert.match(sql, /ON email_logs\(applicant_id\)/);
  assert.match(sql, /status IN \('pending', 'sent'\) AND resend_reason IS NULL/);
  assert.match(sql, /GROUP BY applicant_id/);
  assert.match(sql, /duplicate original pending\/sent emails/);
  assert.match(sql, /DROP INDEX IF EXISTS email_logs_one_original_send_idx/);
});

test("applicant status consistency migration protects operational status fields", async () => {
  const sql = await readFile("db/migrations/010_applicant_status_consistency.sql", "utf8");

  assert.match(sql, /applicants_email_status_consistency_chk/);
  assert.match(sql, /email_status = 'Sent' AND sent_date IS NULL/);
  assert.match(sql, /email_status = 'Failed' AND NULLIF\(trim\(error_message\), ''\) IS NULL/);
  assert.match(sql, /status consistency violation/);
  assert.match(sql, /email_status <> 'Sent' OR sent_date IS NOT NULL/);
  assert.match(sql, /email_status <> 'Failed' OR NULLIF\(trim\(error_message\), ''\) IS NOT NULL/);
});

test("template name integrity migration bounds display names", async () => {
  const sql = await readFile("db/migrations/011_template_name_integrity.sql", "utf8");

  assert.match(sql, /templates_name_safe_chk/);
  assert.match(sql, /\^\[\^\[:cntrl:\]\]\{1,160\}\$/);
  assert.match(sql, /invalid name value/);
  assert.match(sql, /Names must be 160 characters or fewer/);
});
