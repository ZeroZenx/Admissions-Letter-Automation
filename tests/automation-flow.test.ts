import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("applicant API exposes Banner operational status and file columns", async () => {
  const source = await readFile("app/api/applicants/route.ts", "utf8");

  assert.match(source, /email_status, sent_date, word_file_name, pdf_file_name/);
  assert.match(source, /error_message, processed_by_flow, template_type/);
});

test("applicant status export returns Banner workbook with operational columns", async () => {
  const source = await readFile("app/api/applicants/export/route.ts", "utf8");
  const clientSource = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /new ExcelJS\.Workbook\(\)/);
  assert.match(source, /workbook\.addWorksheet\("Admissions"\)/);
  assert.match(source, /bannerFields\.map/);
  assert.match(source, /bannerToDbField/);
  assert.match(source, /Content-Type": "application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet"/);
  assert.match(source, /Content-Disposition": `attachment; filename="costaatt-admissions-status-export\.xlsx"`/);
  assert.match(source, /counselorApplicantWhereClause/);
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

test("PDF conversion updates applicant operational PDF filename", async () => {
  const source = await readFile("app/api/convert-pdf/route.ts", "utf8");
  const converterSource = await readFile("lib/pdf-converter.ts", "utf8");

  assert.match(source, /gl\.applicant_id/);
  assert.match(source, /a\.template_type/);
  assert.match(source, /const pdfFileName = `\$\{letter\.student_id\}-\$\{letter\.template_type\}\.pdf`/);
  assert.match(source, /UPDATE applicants SET pdf_file_name = \$1, error_message = null WHERE id = \$2/);
  assert.match(source, /pdfFileName/);
  assert.match(converterSource, /storageKeyFromPath\(pdfPath\)/);
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

test("generated letters endpoint and table expose operational file names", async () => {
  const routeSource = await readFile("app/api/generated-letters/route.ts", "utf8");
  const clientSource = await readFile("components/app-client.tsx", "utf8");

  assert.match(routeSource, /a\.word_file_name, a\.pdf_file_name/);
  assert.match(clientSource, /word_file_name: string \| null/);
  assert.match(clientSource, /pdf_file_name: string \| null/);
  assert.match(clientSource, /<th>Files<\/th>/);
  assert.match(clientSource, /letter\.word_file_name/);
  assert.match(clientSource, /letter\.pdf_file_name/);
});

test("letter generation records applicant and generated-letter failures", async () => {
  const source = await readFile("app/api/generate-letter/route.ts", "utf8");

  assert.match(source, /throw new HttpError\(400, `No active template for \$\{applicant\.template_type\}\.`/);
  assert.match(source, /UPDATE applicants SET error_message = \$1, processed_by_flow = false WHERE id = \$2/);
  assert.match(source, /UPDATE generated_letters SET status = 'failed', error_message = \$1 WHERE id = \$2/);
  assert.match(source, /letter\.failed/);
  assert.match(source, /audit\("letter\.failed", "applicants"/);
  assert.doesNotMatch(source, /return NextResponse\.json\(\{ error: `No active template/);
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
  assert.match(source, /<input name="autoGenerate" type="checkbox" defaultChecked \/>/);
  assert.match(source, /<input name="autoSend" type="checkbox" defaultChecked \/>/);
  assert.match(source, /Generate DOCX\/PDF files for valid rows after import/);
  assert.match(source, /Send generated PDFs by email after import/);
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

test("bulk generation can send generated PDFs and persist row-level failures", async () => {
  const source = await readFile("app/api/generate-bulk/route.ts", "utf8");

  assert.match(source, /sendEmail: z\.boolean\(\)\.default\(false\)/);
  assert.match(source, /const authEnv = getAuthEnv\(\)/);
  assert.match(source, /x-graph-access-token/);
  assert.match(source, /authEnv\.AUTH_MODE !== "development" && !graphAccessToken/);
  assert.match(source, /Microsoft Graph token is required when sendEmail is true/);
  assert.match(source, /\/api\/send-email/);
  assert.match(source, /UPDATE applicants SET error_message = \$1 WHERE id = \$2/);
  assert.match(source, /batch\.generated/);
  assert.match(source, /requestedCount/);
  assert.match(source, /generatedCount/);
  assert.match(source, /emailedCount/);
  assert.match(source, /failedCount/);
});

test("email send route blocks pending duplicates before database conflicts", async () => {
  const source = await readFile("app/api/send-email/route.ts", "utf8");

  assert.match(source, /WHERE applicant_id = \$1 AND status IN \('pending', 'sent'\) AND resend_reason IS NULL/);
  assert.match(source, /\[letter\.applicant_id\]/);
  assert.match(source, /status IN \('pending', 'sent'\)/);
  assert.match(source, /ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC/);
  assert.match(source, /previousSend\?\.status === "pending"/);
  assert.match(source, /already being sent/);
  assert.match(source, /previousSend\?\.status === "sent" && !body\.resendReason/);
  assert.match(source, /already sent/);
});

test("email send route does not mark delivered mail failed when sent audit logging fails", async () => {
  const source = await readFile("app/api/send-email/route.ts", "utf8");

  assert.match(source, /const authEnv = getAuthEnv\(\)/);
  assert.match(source, /authEnv\.AUTH_MODE !== "development" && !graphAccessToken/);
  assert.match(source, /if \(authEnv\.AUTH_MODE !== "development"\)/);
  assert.match(source, /UPDATE applicants SET email_status = 'Queued' WHERE id = \$1/);
  assert.match(source, /email\.queued/);
  assert.match(source, /Email queue audit failed\./);
  assert.match(source, /UPDATE email_logs SET status = 'failed', error_message = \$1 WHERE id = \$2/);
  assert.match(source, /UPDATE applicants SET email_status = 'Failed', error_message = \$1 WHERE id = \$2/);
  assert.match(source, /UPDATE applicants SET email_status = 'Sending' WHERE id = \$1/);
  assert.match(source, /await sendGraphMail\(/);
  assert.match(source, /UPDATE email_logs SET status = 'sent', sent_at = now\(\) WHERE id = \$1/);
  assert.match(source, /UPDATE applicants SET email_status = 'Sent', sent_date = now\(\), error_message = null WHERE id = \$1/);
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
  assert.match(source, /result\.warning \?\? "Email sent and logged\."/);
});
