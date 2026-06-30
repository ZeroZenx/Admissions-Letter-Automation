import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { readAdmissionsWorksheet, validateBannerRow } from "../lib/import-excel";

test("readAdmissionsWorksheet reads the Admissions worksheet and normalizes known Banner fields", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Admissions");
  sheet.addRow([
    "StudentID",
    "FirstName",
    "LastName",
    "Email",
    "Program",
    "Campus",
    "AdmissionStatus",
    "EmailStatus",
    "SentDate",
    "WordFileName",
    "PDFFileName",
    "ErrorMessage",
    "ProcessedByFlow",
    "TemplateType"
  ]);
  sheet.addRow([
    "A001",
    "Maya",
    "Singh",
    "maya@example.edu",
    "Nursing",
    "City",
    "Admitted",
    "Sent",
    "2026-06-29",
    "A001-UOFFER.docx",
    "A001-UOFFER.pdf",
    "",
    "true",
    "UOFFER"
  ]);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const result = await readAdmissionsWorksheet(buffer);

  assert.equal(result.worksheetName, "Admissions");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].StudentID, "A001");
  assert.equal(result.rows[0].Program, "Nursing");
  assert.equal(result.rows[0].EmailStatus, "Sent");
  assert.equal(result.rows[0].SentDate, "2026-06-29");
  assert.equal(result.rows[0].WordFileName, "A001-UOFFER.docx");
  assert.equal(result.rows[0].PDFFileName, "A001-UOFFER.pdf");
  assert.equal(result.rows[0].ProcessedByFlow, "true");
  assert.equal(result.rows[0].TemplateType, "UOFFER");
});

test("validateBannerRow reports all required field gaps", () => {
  const errors = validateBannerRow({
    StudentID: "",
    FirstName: "Maya",
    LastName: "",
    Email: "",
    Program: "Nursing",
    Campus: "City",
    AdmissionStatus: "Admitted",
    TemplateType: "UOFFER"
  });

  assert.deepEqual(errors, ["StudentID is required", "LastName is required", "Email is required"]);
});
