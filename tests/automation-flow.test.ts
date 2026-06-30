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
  assert.match(source, /if \(validateBannerRow\(row\)\.length\) continue/);
  assert.match(source, /validation_errors = '\[\]'::jsonb/);
});

test("letter generation writes created file names back to applicant records", async () => {
  const source = await readFile("app/api/generate-letter/route.ts", "utf8");

  assert.match(source, /SET word_file_name = \$1/);
  assert.match(source, /pdf_file_name = COALESCE\(\$2, pdf_file_name\)/);
  assert.match(source, /error_message = null/);
});

test("upload UI offers automatic document generation and displays operational columns", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /name="autoGenerate"/);
  assert.match(source, /Generate DOCX\/PDF files for valid rows after import/);
  assert.match(source, /SentDate/);
  assert.match(source, /WordFileName/);
  assert.match(source, /PDFFileName/);
  assert.match(source, /ErrorMessage/);
  assert.match(source, /ProcessedByFlow/);
});
