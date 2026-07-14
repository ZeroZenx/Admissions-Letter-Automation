import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { applicantStatusExportColumns, buildApplicantStatusWorkbook } from "../lib/status-export";

test("buildApplicantStatusWorkbook writes operational status columns and process flow values", async () => {
  const workbook = await buildApplicantStatusWorkbook([
    {
      student_id: "A001",
      first_name: "Maya",
      last_name: "Singh",
      email: "maya@example.edu",
      program: "Nursing",
      campus: "City",
      admission_status: "Admitted",
      email_status: "Sent",
      sent_date: "2026-06-29T13:00:00.000Z",
      word_file_name: "A001-UOFFER.docx",
      pdf_file_name: "A001-UOFFER.pdf",
      error_message: null,
      processed_by_flow: true,
      template_type: "UOFFER"
    }
  ]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const parsed = new ExcelJS.Workbook();
  await parsed.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = parsed.getWorksheet("Admissions");

  assert.ok(sheet);
  assert.equal(sheet.views[0]?.state, "frozen");
  assert.equal(sheet.views[0]?.ySplit, 1);
  assert.equal(sheet.autoFilter, "A1:AL1");

  const headers = sheet.getRow(1).values;
  assert.ok(Array.isArray(headers));
  const headerValues = headers.slice(1).map((header) => String(header));
  assert.deepEqual(headerValues.slice(-3), ["ProcessedByFlow", "ProcessFlow", "TemplateType"]);

  const data = Object.fromEntries(headerValues.map((header, index) => [header, sheet.getRow(2).getCell(index + 1).value]));
  assert.equal(data.EmailStatus, "Sent");
  assert.equal(data.WordFileName, "A001-UOFFER.docx");
  assert.equal(data.PDFFileName, "A001-UOFFER.pdf");
  assert.equal(data.ProcessedByFlow, "true");
  assert.equal(data.ProcessFlow, "UOFFER");
  assert.equal(data.TemplateType, "UOFFER");
  assert.ok(data.SentDate instanceof Date);
  assert.equal((data.SentDate as Date).toISOString().slice(0, 10), "2026-06-29");
});

test("applicantStatusExportColumns selects template_type once for ProcessFlow and TemplateType", () => {
  assert.equal(applicantStatusExportColumns().filter((column) => column === "template_type").length, 1);
});
