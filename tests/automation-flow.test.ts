import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("applicant API exposes Banner operational status and file columns", async () => {
  const source = await readFile("app/api/applicants/route.ts", "utf8");

  assert.match(source, /email_status, sent_date, word_file_name, pdf_file_name/);
  assert.match(source, /error_message, processed_by_flow, template_type/);
  assert.match(source, /readPaginationParams\(url, \{ defaultLimit: listLimits\.applicants, maxLimit: listLimits\.applicants \}\)/);
  assert.match(source, /LIMIT \$\$\{params\.length \+ 1\} OFFSET \$\$\{params\.length \+ 2\}/);
  assert.match(source, /return NextResponse\.json\(\{ applicants: result\.rows, page \}\)/);
});

test("applicant status export returns Banner workbook with operational columns", async () => {
  const source = await readFile("app/api/applicants/export/route.ts", "utf8");
  const clientSource = await readFile("components/app-client.tsx", "utf8");
  const bannerFieldsSource = await readFile("lib/banner-fields.ts", "utf8");
  const statusExportSource = await readFile("lib/status-export.ts", "utf8");

  assert.match(statusExportSource, /new ExcelJS\.Workbook\(\)/);
  assert.match(statusExportSource, /workbook\.addWorksheet\("Admissions"\)/);
  assert.match(statusExportSource, /statusExportFields\.map/);
  assert.match(statusExportSource, /statusExportToDbField/);
  assert.match(bannerFieldsSource, /"ProcessFlow",\n\s+"TemplateType"/);
  assert.match(bannerFieldsSource, /ProcessFlow: "template_type"/);
  assert.match(source, /applicantStatusExportColumns\(\)/);
  assert.match(source, /buildApplicantStatusWorkbook\(result\.rows\)/);
  assert.match(source, /Content-Type": "application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet"/);
  assert.match(source, /Content-Disposition": `attachment; filename="costaatt-admissions-status-export\.xlsx"`/);
  assert.match(source, /counselorApplicantWhereClause/);
  assert.match(source, /SELECT count\(\*\) AS count/);
  assert.match(source, /exportCount > uploadLimits\.statusExportRows/);
  assert.match(source, /exceeds the \$\{uploadLimits\.statusExportRows\} row export limit/);
  assert.match(source, /Apply filters before exporting/);
  assert.match(source, /applicants\.exported/);
  assert.doesNotMatch(source, /storage_key/);
  assert.match(clientSource, /async function downloadApplicantExport\(\)/);
  assert.match(clientSource, /\/api\/applicants\/export\?/);
  assert.match(clientSource, /Export Status/);
});

test("import route returns valid applicant ids for upload-time automation", async () => {
  const source = await readFile("app/api/import/route.ts", "utf8");

  assert.match(source, /validApplicantIds/);
  assert.match(source, /buildAutomationPreflight/);
  assert.match(source, /preflight/);
  assert.match(source, /uploadedByCounselorId = user\.roles\.includes\("Counselor"\) \? dbUser\.id : undefined/);
  assert.match(source, /rowToApplicantColumns\(row, importId, uploadedByCounselorId\)/);
  assert.match(source, /invalidRowNumbers/);
  assert.match(source, /if \(invalidRowNumbers\.has\(index \+ 2\)\) continue/);
  assert.match(source, /invalidRows\.length \? "review" : "imported"/);
  assert.match(source, /validation_errors = '\[\]'::jsonb/);
});

test("import route rejects duplicate applicant template rows before insertion", async () => {
  const source = await readFile("app/api/import/route.ts", "utf8");

  assert.match(source, /findDuplicateApplicantKeys\(workbook\.rows\)/);
  assert.match(source, /applicantDuplicateKey\(row\)/);
  assert.match(source, /Duplicate StudentID and TemplateType in workbook/);
  assert.match(source, /invalidRowNumbers/);
  assert.match(source, /for \(const \[index, row\] of workbook\.rows\.entries\(\)\)/);
  assert.match(source, /if \(invalidRowNumbers\.has\(index \+ 2\)\) continue/);
  assert.match(source, /studentId && templateType \? `\$\{studentId\}\\u0000\$\{templateType\}` : ""/);
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
  assert.match(source, /readPaginationParams\(url, \{ defaultLimit: listLimits\.imports, maxLimit: listLimits\.imports \}\)/);
  assert.match(source, /LIMIT \$1 OFFSET \$2/);
  assert.match(source, /return NextResponse\.json\(\{ imports: result\.rows, page \}\)/);
  assert.doesNotMatch(source, /storage_key/);
});

test("import history tolerates malformed stored error details", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /function formatImportErrors\(errors: unknown\)/);
  assert.match(source, /if \(!Array\.isArray\(errors\)\) return ""/);
  assert.match(source, /formatImportErrors\(record\.errors\)/);
  assert.doesNotMatch(source, /record\.errors\?\.slice/);
});

test("letter generation writes created file names back to applicant records", async () => {
  const source = await readFile("app/api/generate-letter/route.ts", "utf8");

  assert.match(source, /import \{ letterDownloadFileName \} from "@\/lib\/download-filenames"/);
  assert.match(source, /const fileBase = letterDownloadFileName\(String\(applicant\.student_id\), String\(applicant\.template_type\), "docx"\)/);
  assert.match(source, /UPDATE applicants SET word_file_name = \$1 WHERE id = \$2/);
  assert.match(source, /SET word_file_name = \$1/);
  assert.match(source, /pdf_file_name = COALESCE\(\$2, pdf_file_name\)/);
  assert.match(source, /wordFileName: fileBase/);
  assert.match(source, /pdfFileName/);
  assert.match(source, /error_message = null/);
  assert.match(source, /processed_by_flow = true/);

  const wordFileUpdateIndex = source.indexOf("UPDATE applicants SET word_file_name = $1 WHERE id = $2");
  const pdfConversionIndex = source.indexOf("convertDocxToPdf(docxStorageKey)");
  assert.ok(wordFileUpdateIndex > -1);
  assert.ok(pdfConversionIndex > wordFileUpdateIndex);
});

test("letter generation blocks unmapped template placeholders server-side", async () => {
  const source = await readFile("app/api/generate-letter/route.ts", "utf8");

  assert.match(source, /missingTemplateMappings\(template\.placeholders, mappings\.rows\)/);
  assert.match(source, /throw new HttpError\(400, `Template \$\{String\(applicant\.template_type\)\} has unmapped placeholders:/);
  assert.match(source, /const mapped = new Set\(mappings\.map\(\(mapping\) => mapping\.placeholder\)\)/);
  assert.match(source, /placeholderNames\.filter\(\(name\) => !mapped\.has\(name\)\)/);
});

test("letter generation reports missing template files before merging", async () => {
  const source = await readFile("app/api/generate-letter/route.ts", "utf8");

  assert.match(source, /storageFileExists\(String\(template\.storage_key\)\)/);
  assert.match(source, /Template file for \$\{String\(applicant\.template_type\)\} was not found in storage/);
  assert.match(source, /Re-upload and activate the template before generating letters/);
  assert.match(source, /throw new HttpError\(400/);

  const missingFileIndex = source.indexOf("Template file for ${String(applicant.template_type)} was not found in storage");
  const readTemplateIndex = source.indexOf("const templateBuffer = await readStorageBuffer");

  assert.ok(missingFileIndex > -1);
  assert.ok(readTemplateIndex > missingFileIndex);
});

test("PDF conversion updates applicant operational PDF filename", async () => {
  const source = await readFile("app/api/convert-pdf/route.ts", "utf8");
  const converterSource = await readFile("lib/pdf-converter.ts", "utf8");

  assert.match(source, /gl\.applicant_id/);
  assert.match(source, /a\.template_type/);
  assert.match(source, /import \{ letterDownloadFileName \} from "@\/lib\/download-filenames"/);
  assert.match(source, /const pdfFileName = letterDownloadFileName\(letter\.student_id, letter\.template_type, "pdf"\)/);
  assert.match(source, /UPDATE generated_letters SET pdf_storage_key = \$1, status = 'pdf_generated', error_message = null WHERE id = \$2/);
  assert.match(source, /UPDATE applicants SET pdf_file_name = \$1, error_message = null, processed_by_flow = true WHERE id = \$2/);
  assert.match(source, /pdfFileName/);
  assert.match(converterSource, /storageKeyFromPath\(pdfPath\)/);
});

test("PDF conversion clears stale generated-letter errors after a successful retry", async () => {
  const source = await readFile("app/api/convert-pdf/route.ts", "utf8");

  assert.match(source, /status = 'pdf_generated', error_message = null/);

  const successIndex = source.indexOf("UPDATE generated_letters SET pdf_storage_key = $1, status = 'pdf_generated', error_message = null");
  const applicantSuccessIndex = source.indexOf("UPDATE applicants SET pdf_file_name = $1, error_message = null, processed_by_flow = true");
  const failureIndex = source.indexOf("UPDATE generated_letters SET status = 'failed', error_message = $1");

  assert.ok(successIndex > -1);
  assert.ok(applicantSuccessIndex > successIndex);
  assert.ok(failureIndex > applicantSuccessIndex);
});

test("PDF conversion records generated-letter and applicant failures", async () => {
  const source = await readFile("app/api/convert-pdf/route.ts", "utf8");

  assert.match(source, /let generatedLetterId: string \| undefined/);
  assert.match(source, /failureLetter = letter/);
  assert.match(source, /UPDATE generated_letters SET status = 'failed', error_message = \$1 WHERE id = \$2/);
  assert.match(source, /UPDATE applicants SET error_message = \$1, processed_by_flow = false WHERE id = \$2/);
  assert.match(source, /audit\("letter\.failed", "generated_letters"/);
  assert.match(source, /Unknown PDF conversion failure/);
});

test("PDF conversion reports missing generated DOCX files before LibreOffice", async () => {
  const source = await readFile("app/api/convert-pdf/route.ts", "utf8");

  assert.match(source, /storageFileExists\(letter\.docx_storage_key\)/);
  assert.match(source, /Generated DOCX file was not found in storage\. Regenerate the letter before converting to PDF\./);

  const missingDocxIndex = source.indexOf("Generated DOCX file was not found in storage.");
  const convertIndex = source.indexOf("const pdfStorageKey = await convertDocxToPdf");

  assert.ok(missingDocxIndex > -1);
  assert.ok(convertIndex > missingDocxIndex);
});

test("generated letters endpoint and table expose operational file names", async () => {
  const routeSource = await readFile("app/api/generated-letters/route.ts", "utf8");
  const clientSource = await readFile("components/app-client.tsx", "utf8");

  assert.match(routeSource, /a\.word_file_name, a\.pdf_file_name/);
  assert.match(routeSource, /readPaginationParams\(url, \{\n\s+defaultLimit: listLimits\.generatedLetters,\n\s+maxLimit: listLimits\.generatedLetters\n\s+\}\)/);
  assert.match(routeSource, /LIMIT \$\$\{ownership\.params\.length \+ 1\} OFFSET \$\$\{ownership\.params\.length \+ 2\}/);
  assert.match(routeSource, /return NextResponse\.json\(\{ generatedLetters: result\.rows, page \}\)/);
  assert.match(clientSource, /word_file_name: string \| null/);
  assert.match(clientSource, /pdf_file_name: string \| null/);
  assert.match(clientSource, /<th>Files<\/th>/);
  assert.match(clientSource, /letter\.word_file_name/);
  assert.match(clientSource, /letter\.pdf_file_name/);
});

test("letter generation records applicant and generated-letter failures", async () => {
  const source = await readFile("app/api/generate-letter/route.ts", "utf8");

  assert.match(source, /throw new HttpError\(400, `No active template for \$\{applicant\.template_type\}\.`/);
  assert.match(source, /hasValidationErrors\(applicant\.validation_errors\)/);
  assert.match(source, /has source-truth validation errors\. Correct the Banner row before generating a letter\./);
  assert.match(source, /UPDATE applicants SET error_message = \$1, processed_by_flow = false WHERE id = \$2/);
  assert.match(source, /UPDATE generated_letters SET status = 'failed', error_message = \$1 WHERE id = \$2/);
  assert.match(source, /letter\.failed/);
  assert.match(source, /audit\("letter\.failed", "applicants"/);
  assert.doesNotMatch(source, /return NextResponse\.json\(\{ error: `No active template/);
});

test("letter generation queries only required applicant and template fields", async () => {
  const source = await readFile("app/api/generate-letter/route.ts", "utf8");

  assert.match(source, /const applicantSelect = `/);
  assert.match(source, /SELECT id, counselor_user_id, student_id, term, first_name, middle_name, last_name,/);
  assert.match(source, /processed_by_flow, template_type, raw_data, validation_errors/);
  assert.match(source, /query<ApplicantGenerationRow>\(applicantSelect, \[body\.applicantId\]\)/);
  assert.match(source, /query<TemplateGenerationRow>/);
  assert.match(source, /SELECT id, template_type, storage_key, placeholders/);
  assert.doesNotMatch(source, /SELECT \* FROM applicants/);
  assert.doesNotMatch(source, /SELECT \* FROM templates/);
});

test("upload UI offers automatic document generation and displays operational columns", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /Import Review/);
  assert.match(source, /Rows Needing Review/);
  assert.match(source, /Automation preflight blocked/);
  assert.match(source, /blockedTemplates\.length/);
  assert.match(source, /missingPlaceholderNames/);
  assert.match(source, /name="autoGenerate"/);
  assert.match(source, /<input name="autoGenerate" type="hidden" value="on" \/>/);
  assert.doesNotMatch(source, /name="autoSend"/);
  assert.match(source, /validApplicantIds\.length > uploadLimits\.bulkApplicantIds/);
  assert.match(source, /exceed the \$\{uploadLimits\.bulkApplicantIds\} applicant batch limit/);
  assert.match(source, /Filter or split the Banner export before generating letters/);
  assert.match(source, /Preparation: import records, apply stored templates, and generate DOCX\/PDF files for staff review\./);
  assert.match(source, /Upload Source of Truth and Prepare Letters/);
  assert.match(source, /No emails were sent\. Review the letters under Generate Letters, then open Email Queue and select recipients manually\./);
  assert.doesNotMatch(source, /sendEmail: autoSend/);
  assert.match(source, /Automation ready/);
  assert.match(source, /Import, generate, email, and track admissions letters from Banner source data\./);
  assert.doesNotMatch(source, /Review required/);
  assert.doesNotMatch(source, /before any email is sent/);
  assert.match(source, /authenticatedGraphFetch/);
  assert.match(source, /SentDate/);
  assert.match(source, /WordFileName/);
  assert.match(source, /PDFFileName/);
  assert.match(source, /ErrorMessage/);
  assert.match(source, /ProcessedByFlow/);
});

test("operator docs describe upload preparation without automatic email sending", async () => {
  const readme = await readFile("README.md", "utf8");
  const checklist = await readFile("docs/production-readiness.md", "utf8");

  assert.match(readme, /One-click upload prepares all valid rows/);
  assert.match(readme, /never sends email or selects recipients automatically/);
  assert.match(checklist, /Confirm one-click upload prepares valid rows/);
  assert.match(checklist, /neither sends email nor selects recipients/);
});

test("upload automation failures release busy state and report an error", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /async function uploadImport\(formData: FormData\)/);
  assert.match(source, /try \{\n\s+const autoGenerate = formData\.get\("autoGenerate"\) === "on"/);
  assert.match(source, /catch \(error\) \{\n\s+importedMessage = `\$\{importedMessage\} Automatic generation failed: \$\{clientErrorMessage\(error\)\}\.`/);
  assert.match(source, /catch \(error\) \{\n\s+setMessage\(clientErrorMessage\(error\)\);/);
  assert.match(source, /finally \{\n\s+setBusy\(false\);/);
  assert.match(source, /function clientErrorMessage\(error: unknown\)/);
});

test("manual bulk generation blocks oversized selections before calling the API", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /async function generateSelected\(\)/);
  assert.match(source, /selectedApplicants\.length > uploadLimits\.bulkApplicantIds/);
  assert.match(source, /selected applicants exceed the \$\{uploadLimits\.bulkApplicantIds\} applicant batch limit/);
  assert.match(source, /Clear the selection or split the batch before generating letters/);

  const limitCheckIndex = source.indexOf("selectedApplicants.length > uploadLimits.bulkApplicantIds");
  const apiCallIndex = source.indexOf('authenticatedFetch("/api/generate-bulk"', limitCheckIndex);
  assert.ok(limitCheckIndex > -1);
  assert.ok(apiCallIndex > limitCheckIndex);
});

test("workspace actions release busy state when requests throw", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /async function uploadTemplate\(formData: FormData\)/);
  assert.match(source, /Template upload failed: \$\{clientErrorMessage\(error\)\}/);
  assert.match(source, /Template status could not be updated: \$\{clientErrorMessage\(error\)\}/);
  assert.match(source, /Could not save field mappings: \$\{clientErrorMessage\(error\)\}/);
  assert.match(source, /Generation failed: \$\{clientErrorMessage\(error\)\}/);
  assert.match(source, /Email batch could not be sent: \$\{clientErrorMessage\(error\)\}/);
  assert.match(source, /Settings could not be saved: \$\{clientErrorMessage\(error\)\}/);
  assert.match(source, /finally \{\n\s+setBusy\(false\);\n\s+\}\n\s+\}\n\n\s+async function updateTemplateStatus/);
  assert.match(source, /finally \{\n\s+setBusy\(false\);\n\s+\}\n\s+\}\n\n\s+async function saveMappings/);
  assert.match(source, /finally \{\n\s+setBusy\(false\);\n\s+\}\n\s+\}\n\n\s+async function generateSelected/);
  assert.match(source, /finally \{\n\s+setBusy\(false\);\n\s+\}\n\s+\}\n\n\s+return \(/);
});

test("email queue sends selected generated PDFs as a bounded batch", async () => {
  const routeSource = await readFile("app/api/send-email/bulk/route.ts", "utf8");
  const clientSource = await readFile("components/app-client.tsx", "utf8");

  assert.match(routeSource, /generatedLetterIds: z\.array\(z\.string\(\)\.uuid\(\)\)\.min\(1\)\.max\(uploadLimits\.bulkEmailGeneratedLetterIds\)/);
  assert.match(routeSource, /new Set\(input\.generatedLetterIds\)\.size !== input\.generatedLetterIds\.length/);
  assert.match(routeSource, /requireAuth\(request, \["Admin", "Admissions Supervisor", "Counselor"\]\)/);
  assert.match(routeSource, /settings\.email\.provider === "graph"/);
  assert.match(routeSource, /for \(const generatedLetterId of input\.generatedLetterIds\)/);
  assert.match(routeSource, /fetch\(`\$\{origin\}\/api\/send-email`/);
  assert.match(routeSource, /email\.batch_completed/);
  assert.match(routeSource, /sentCount/);
  assert.match(routeSource, /failedCount/);

  assert.match(clientSource, /const \[selectedGeneratedLetters, setSelectedGeneratedLetters\] = useState<string\[\]>\(\[\]\)/);
  assert.match(clientSource, /if \(generationResponse\.ok\) setSelectedGeneratedLetters\(\[\]\)/);
  assert.match(clientSource, /if \(response\.ok\) setSelectedGeneratedLetters\(\[\]\)/);
  assert.doesNotMatch(clientSource, /setActive\("email"\)/);
  assert.match(clientSource, /authenticatedGraphFetch : authenticatedFetch/);
  assert.match(clientSource, /"\/api\/send-email\/bulk"/);
  assert.match(clientSource, /Send \{selected\.length \|\| ""\} Selected Email/);
  assert.match(clientSource, /aria-label="Select all visible generated letters"/);
  assert.match(clientSource, /disabled=\{!letter\.pdf_ready\}/);
  assert.match(clientSource, /onSelected\(selected\.filter\(\(id\) => !sentIds\.includes\(id\)\)\)/);
});

test("bulk generation is generation-only and cannot send email", async () => {
  const source = await readFile("app/api/generate-bulk/route.ts", "utf8");

  assert.match(source, /applicantIds: z\.array\(z\.string\(\)\.uuid\(\)\)\.min\(1\)\.max\(uploadLimits\.bulkApplicantIds\)/);
  assert.match(source, /\}\)\.strict\(\)/);
  assert.match(source, /hasDuplicateApplicantIds\(body\.applicantIds\)/);
  assert.match(source, /Bulk automation applicantIds must be unique\./);
  assert.doesNotMatch(source, /sendEmail/);
  assert.doesNotMatch(source, /\/api\/send-email/);
  assert.doesNotMatch(source, /x-graph-access-token/);
  assert.match(source, /generationResult = await readResponseJson\(response\)/);
  assert.match(source, /UPDATE applicants SET error_message = \$1, processed_by_flow = false WHERE id = \$2/);
  assert.match(source, /batch\.generated/);
  assert.match(source, /requestedCount/);
  assert.match(source, /generatedCount/);
  assert.match(source, /failedCount/);

  const duplicateCheckIndex = source.indexOf("hasDuplicateApplicantIds(body.applicantIds)");
  const preflightIndex = source.indexOf("buildBulkAutomationPreflight(body.applicantIds, user, dbUser.id)");
  const firstGenerationIndex = source.indexOf('fetch(`${origin}/api/generate-letter`');
  assert.ok(duplicateCheckIndex > -1);
  assert.ok(preflightIndex > duplicateCheckIndex);
  assert.ok(firstGenerationIndex > duplicateCheckIndex);
});

test("bulk generation preflights selected applicants before starting automation", async () => {
  const source = await readFile("app/api/generate-bulk/route.ts", "utf8");

  assert.match(source, /buildBulkAutomationPreflight\(body\.applicantIds, user, dbUser\.id\)/);
  assert.match(source, /missingOrUnavailableCount > 0/);
  assert.match(source, /invalidApplicantCount > 0/);
  assert.match(source, /blockedTemplates\.length > 0/);
  assert.match(source, /Automation preflight blocked/);
  assert.match(source, /counselorApplicantWhereClause\(user, dbUserId, 2\)/);
  assert.match(source, /WHERE id = ANY\(\$1::uuid\[\]\)/);
  assert.match(source, /validation_errors/);
  assert.match(source, /t\.template_type = ANY\(\$1::text\[\]\)/);
  assert.match(source, /missing_template/);
  assert.match(source, /inactive_template/);
  assert.match(source, /missing_mappings/);

  const preflightIndex = source.indexOf("buildBulkAutomationPreflight(body.applicantIds, user, dbUser.id)");
  const firstGenerationIndex = source.indexOf('fetch(`${origin}/api/generate-letter`');
  assert.ok(preflightIndex > -1);
  assert.ok(firstGenerationIndex > preflightIndex);
});

test("bulk generation keeps row-level failures when internal APIs return non-json", async () => {
  const source = await readFile("app/api/generate-bulk/route.ts", "utf8");

  assert.match(source, /async function readResponseJson\(response: Response\)/);
  assert.match(source, /try \{\n\s+return normalizeInternalResponse\(await response\.json\(\)\);/);
  assert.match(source, /catch \{\n\s+return \{ error: boundedErrorMessage\(`\$\{response\.status\} \$\{response\.statusText \|\| "Non-JSON response"\}`\) \};/);
  assert.match(source, /const errorMessage = readError\(generationResult\)/);
});

test("bulk generation keeps row-level failures when internal API calls throw", async () => {
  const source = await readFile("app/api/generate-bulk/route.ts", "utf8");

  assert.match(source, /let generated = false/);
  assert.match(source, /let generationResult: unknown = null/);
  assert.match(source, /catch \(error\) \{\n\s+generationResult = \{ error: clientErrorMessage\(error\) \};/);
  assert.doesNotMatch(source, /emailResult/);
  assert.match(source, /ok: generated/);
  assert.match(source, /generated,/);
  assert.match(source, /function clientErrorMessage\(error: unknown\)/);
});

test("bulk generation bounds internal error messages before storing row failures", async () => {
  const source = await readFile("app/api/generate-bulk/route.ts", "utf8");

  assert.match(source, /const BULK_ERROR_MESSAGE_LIMIT = 1000/);
  assert.match(source, /return boundedErrorMessage\(value\.error\)/);
  assert.match(source, /return normalizeInternalResponse\(await response\.json\(\)\)/);
  assert.match(source, /function normalizeInternalResponse\(value: unknown\)/);
  assert.match(source, /\{ \.\.\.value, error: boundedErrorMessage\(value\.error\) \}/);
  assert.match(source, /function boundedErrorMessage\(message: string\)/);
  assert.match(source, /message\.trim\(\) \|\| "Batch automation failed\."/);
  assert.match(source, /trimmed\.slice\(0, BULK_ERROR_MESSAGE_LIMIT - 3\)/);
});

test("email send route blocks pending duplicates before database conflicts", async () => {
  const source = await readFile("app/api/send-email/route.ts", "utf8");

  assert.match(source, /Pending email send timed out before completion\./);
  assert.match(source, /const settings = await getAppSettings\(\)/);
  assert.match(source, /created_at < now\(\) - \(\$2::int \* interval '1 minute'\)/);
  assert.match(source, /settings\.email\.stalePendingMinutes/);
  assert.match(source, /if \(stalePendingResult\.rowCount\)/);
  assert.match(source, /UPDATE applicants SET email_status = 'Failed', error_message = \$1 WHERE id = \$2/);
  assert.match(source, /email\.stale_failed/);
  assert.match(source, /stalePendingResult\.rows/);
  assert.match(source, /WHERE applicant_id = \$1 AND status IN \('pending', 'sent'\) AND resend_reason IS NULL/);
  assert.match(source, /\[letter\.applicant_id\]/);
  assert.match(source, /status IN \('pending', 'sent'\)/);
  assert.match(source, /ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC/);
  assert.match(source, /previousSend\?\.status === "pending"/);
  assert.match(source, /already being sent/);
  assert.match(source, /previousSend\?\.status === "sent" && !body\.resendReason/);
  assert.match(source, /already sent/);

  const staleCleanupIndex = source.indexOf("Pending email send timed out before completion.");
  const duplicateCheckIndex = source.indexOf("SELECT id, status FROM email_logs");
  assert.ok(staleCleanupIndex > -1);
  assert.ok(duplicateCheckIndex > staleCleanupIndex);
});

test("email send route records missing generated PDFs before sending", async () => {
  const source = await readFile("app/api/send-email/route.ts", "utf8");

  assert.match(source, /if \(!letter\.pdf_storage_key\) \{/);
  assert.match(source, /const errorMessage = "Generate the PDF before sending email\."/);
  assert.match(source, /email\.blocked_pdf_not_generated/);
  assert.match(source, /storageFileExists\(letter\.pdf_storage_key\)/);
  assert.match(source, /Generated PDF file was not found in storage\. Regenerate the letter before sending email\./);
  assert.match(source, /UPDATE applicants SET email_status = 'Failed', error_message = \$1 WHERE id = \$2/);
  assert.match(source, /email\.blocked_missing_pdf/);
  assert.match(source, /return NextResponse\.json\(\{ error: errorMessage \}, \{ status: 404 \}\)/);

  const missingPdfIndex = source.indexOf("Generated PDF file was not found in storage.");
  const readPdfIndex = source.indexOf("const pdf = await readStorageBuffer");
  const emailLogIndex = source.indexOf("INSERT INTO email_logs");

  assert.ok(missingPdfIndex > -1);
  assert.ok(readPdfIndex > missingPdfIndex);
  assert.ok(emailLogIndex > missingPdfIndex);
});

test("email send route records oversized generated PDFs before sending", async () => {
  const source = await readFile("app/api/send-email/route.ts", "utf8");

  assert.match(source, /pdf\.byteLength > uploadLimits\.pdfAttachmentBytes/);
  assert.match(source, /const errorMessage = `Generated PDF exceeds the \$\{formatBytes\(uploadLimits\.pdfAttachmentBytes\)\} email attachment limit\.`/);
  assert.match(source, /UPDATE applicants SET email_status = 'Failed', error_message = \$1 WHERE id = \$2/);
  assert.match(source, /email\.blocked_oversized_pdf/);
  assert.match(source, /return NextResponse\.json\(\{ error: errorMessage \}, \{ status: 413 \}\)/);

  const oversizedPdfIndex = source.indexOf("pdf.byteLength > uploadLimits.pdfAttachmentBytes");
  const emailLogIndex = source.indexOf("INSERT INTO email_logs");
  assert.ok(oversizedPdfIndex > -1);
  assert.ok(emailLogIndex > oversizedPdfIndex);
});

test("email send route does not mark delivered mail failed when sent audit logging fails", async () => {
  const source = await readFile("app/api/send-email/route.ts", "utf8");

  assert.match(source, /const authEnv = getAuthEnv\(\)/);
  assert.match(source, /authEnv\.AUTH_MODE !== "development" && !graphAccessToken/);
  assert.match(source, /if \(authEnv\.AUTH_MODE !== "development"\)/);
  assert.match(source, /import \{ letterDownloadFileName \} from "@\/lib\/download-filenames"/);
  assert.match(source, /a\.student_id, a\.template_type, a\.email/);
  assert.match(source, /UPDATE applicants SET email_status = 'Queued', sent_date = null, error_message = null WHERE id = \$1/);
  assert.match(source, /email\.queued/);
  assert.match(source, /Email queue audit failed\./);
  assert.match(source, /UPDATE email_logs SET status = 'failed', error_message = \$1 WHERE id = \$2/);
  assert.match(source, /UPDATE applicants SET email_status = 'Failed', error_message = \$1 WHERE id = \$2/);
  assert.match(source, /UPDATE applicants SET email_status = 'Sending', sent_date = null, error_message = null WHERE id = \$1/);
  assert.match(source, /await sendGraphMail\(/);
  assert.match(source, /attachmentName: letterDownloadFileName\(letter\.student_id, letter\.template_type, "pdf"\)/);
  assert.match(source, /UPDATE email_logs SET status = 'sent', sent_at = now\(\) WHERE id = \$1/);
  assert.match(source, /UPDATE applicants SET email_status = 'Sent', sent_date = now\(\), error_message = null, processed_by_flow = true WHERE id = \$1/);
  assert.match(source, /let auditLogged = true/);
  assert.match(source, /auditLogged = false/);
  assert.match(source, /Email was sent, but audit logging failed/);
  assert.match(source, /audit\("email\.failed", "email_logs"/);
  assert.match(source, /emailLog\.rows\[0\]\.id, dbUser\.id\)\.catch\(\(\) => undefined\)/);
  assert.match(source, /throw error/);

  const graphSendIndex = source.indexOf("await sendGraphMail(");
  const sentUpdateIndex = source.indexOf("UPDATE email_logs SET status = 'sent'");
  const queuedAuditIndex = source.indexOf('audit("email.queued"');
  const sendingUpdateIndex = source.indexOf("UPDATE applicants SET email_status = 'Sending'");
  const catchIndex = source.indexOf("} catch (error) {", graphSendIndex);

  assert.ok(graphSendIndex > -1);
  assert.ok(queuedAuditIndex > -1);
  assert.ok(sendingUpdateIndex > queuedAuditIndex);
  assert.ok(sentUpdateIndex > graphSendIndex);
  assert.ok(catchIndex > graphSendIndex);
  assert.ok(sentUpdateIndex > catchIndex);
});

test("email queue surfaces sent-with-warning responses", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /warning\?: string/);
  assert.match(source, /warningCount\?: number/);
  assert.match(source, /sent with an audit warning/);
});

test("email send route clears stale applicant status details while queued or sending", async () => {
  const source = await readFile("app/api/send-email/route.ts", "utf8");

  assert.match(source, /UPDATE applicants SET email_status = 'Queued', sent_date = null, error_message = null WHERE id = \$1/);
  assert.match(source, /UPDATE applicants SET email_status = 'Sending', sent_date = null, error_message = null WHERE id = \$1/);

  const queuedIndex = source.indexOf("UPDATE applicants SET email_status = 'Queued', sent_date = null, error_message = null");
  const sendingIndex = source.indexOf("UPDATE applicants SET email_status = 'Sending', sent_date = null, error_message = null");
  const sentIndex = source.indexOf("UPDATE applicants SET email_status = 'Sent', sent_date = now(), error_message = null");

  assert.ok(queuedIndex > -1);
  assert.ok(sendingIndex > queuedIndex);
  assert.ok(sentIndex > sendingIndex);
});
