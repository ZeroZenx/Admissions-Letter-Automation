import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("applicant API exposes Banner operational status and file columns", async () => {
  const source = await readFile("app/api/applicants/route.ts", "utf8");

  assert.match(source, /email_status, sent_date, word_file_name, pdf_file_name/);
  assert.match(source, /error_message, processed_by_flow, template_type/);
});

test("import route returns valid applicant ids for upload-time automation", async () => {
  const source = await readFile("app/api/import/route.ts", "utf8");

  assert.match(source, /validApplicantIds/);
  assert.match(source, /buildAutomationPreflight/);
  assert.match(source, /preflight/);
  assert.match(source, /if \(validateBannerRow\(row\)\.length\) continue/);
  assert.match(source, /invalidRows\.length \? "review" : "imported"/);
  assert.match(source, /validation_errors = '\[\]'::jsonb/);
});

test("import automation preflight checks template readiness before generation", async () => {
  const source = await readFile("app/api/import/route.ts", "utf8");

  assert.match(source, /missing_template/);
  assert.match(source, /inactive_template/);
  assert.match(source, /missing_mappings/);
  assert.match(source, /missingPlaceholderNames/);
  assert.match(source, /mapped\.has\(name\)/);
});

test("imports endpoint exposes upload review metadata without storage paths", async () => {
  const source = await readFile("app/api/imports/route.ts", "utf8");

  assert.match(source, /uploaded_file_name/);
  assert.match(source, /total_rows, i\.valid_rows, i\.invalid_rows, i\.status, i\.errors/);
  assert.match(source, /LEFT JOIN users/);
  assert.doesNotMatch(source, /storage_key/);
});

test("letter generation writes created file names back to applicant records", async () => {
  const source = await readFile("app/api/generate-letter/route.ts", "utf8");

  assert.match(source, /SET word_file_name = \$1/);
  assert.match(source, /pdf_file_name = COALESCE\(\$2, pdf_file_name\)/);
  assert.match(source, /error_message = null/);
  assert.match(source, /processed_by_flow = true/);
});

test("letter generation records applicant and generated-letter failures", async () => {
  const source = await readFile("app/api/generate-letter/route.ts", "utf8");

  assert.match(source, /UPDATE applicants SET error_message = \$1, processed_by_flow = false WHERE id = \$2/);
  assert.match(source, /UPDATE generated_letters SET status = 'failed', error_message = \$1 WHERE id = \$2/);
  assert.match(source, /letter\.failed/);
});

test("upload UI offers automatic document generation and displays operational columns", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /Import Review/);
  assert.match(source, /Rows Needing Review/);
  assert.match(source, /Automation preflight blocked/);
  assert.match(source, /blockedTemplates\.length/);
  assert.match(source, /missingPlaceholderNames/);
  assert.match(source, /name="autoGenerate"/);
  assert.match(source, /name="autoSend"/);
  assert.match(source, /Generate DOCX\/PDF files for valid rows after import/);
  assert.match(source, /Send generated PDFs by email after import/);
  assert.match(source, /authenticatedGraphFetch/);
  assert.match(source, /SentDate/);
  assert.match(source, /WordFileName/);
  assert.match(source, /PDFFileName/);
  assert.match(source, /ErrorMessage/);
  assert.match(source, /ProcessedByFlow/);
});

test("bulk generation can send generated PDFs and persist row-level failures", async () => {
  const source = await readFile("app/api/generate-bulk/route.ts", "utf8");

  assert.match(source, /sendEmail: z\.boolean\(\)\.default\(false\)/);
  assert.match(source, /x-graph-access-token/);
  assert.match(source, /\/api\/send-email/);
  assert.match(source, /UPDATE applicants SET error_message = \$1 WHERE id = \$2/);
});
