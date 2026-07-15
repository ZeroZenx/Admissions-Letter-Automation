import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { HttpError } from "../lib/auth";
import { readAdmissionsWorksheet, rowToApplicantColumns, validateBannerRow } from "../lib/import-excel";

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

test("readAdmissionsWorksheet accepts human-spaced operational headers", async () => {
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
    "Email Status",
    "Sent Date",
    "Word File Name",
    "PDF File Name",
    "Error Message",
    "Processed By Flow",
    "Process Flow"
  ]);
  sheet.addRow([
    "A002",
    "Noah",
    "Ramdial",
    "noah@example.edu",
    "Business",
    "Main",
    "Conditional",
    "Failed",
    "",
    "A002-CONDOFFER.docx",
    "A002-CONDOFFER.pdf",
    "Missing CSEC result",
    "yes",
    "CONDOFFER_CSEC_PT"
  ]);

  const result = await readAdmissionsWorksheet(Buffer.from(await workbook.xlsx.writeBuffer()));

  assert.equal(result.rows[0].EmailStatus, "Failed");
  assert.equal(result.rows[0].WordFileName, "A002-CONDOFFER.docx");
  assert.equal(result.rows[0].PDFFileName, "A002-CONDOFFER.pdf");
  assert.equal(result.rows[0].ErrorMessage, "Missing CSEC result");
  assert.equal(result.rows[0].ProcessedByFlow, "yes");
  assert.equal(result.rows[0].TemplateType, "CONDOFFER_CSEC_PT");
});

test("readAdmissionsWorksheet rejects workbooks without Admissions as a bad upload", async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Sheet1").addRow(["StudentID"]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  await assert.rejects(
    readAdmissionsWorksheet(buffer),
    (error) =>
      error instanceof HttpError &&
      error.status === 400 &&
      error.message === "The workbook must include a worksheet named Admissions."
  );
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

test("validateBannerRow reports malformed email addresses before automation", () => {
  const errors = validateBannerRow({
    StudentID: "A001",
    FirstName: "Maya",
    LastName: "Singh",
    Email: "maya.example.edu",
    Program: "Nursing",
    Campus: "City",
    AdmissionStatus: "Admitted",
    TemplateType: "UOFFER"
  });

  assert.deepEqual(errors, ["Email must be a valid email address"]);
});

test("validateBannerRow reports malformed operational dates before import", () => {
  const errors = validateBannerRow({
    StudentID: "A001",
    FirstName: "Maya",
    LastName: "Singh",
    Email: "maya@example.edu",
    Program: "Nursing",
    Campus: "City",
    AdmissionStatus: "Admitted",
    DateGenerated: "06/29/2026",
    BirthDate: "2026-02-30",
    SentDate: "yesterday",
    TemplateType: "UOFFER"
  });

  assert.deepEqual(errors, [
    "DateGenerated must be a valid date in YYYY-MM-DD format",
    "BirthDate must be a valid date in YYYY-MM-DD format",
    "SentDate must be a valid date in YYYY-MM-DD format"
  ]);
});

test("validateBannerRow reports inconsistent email status fields before import", () => {
  assert.deepEqual(
    validateBannerRow({
      StudentID: "A001",
      FirstName: "Maya",
      LastName: "Singh",
      Email: "maya@example.edu",
      Program: "Nursing",
      Campus: "City",
      AdmissionStatus: "Admitted",
      EmailStatus: "Delivered",
      TemplateType: "UOFFER"
    }),
    ["EmailStatus must be one of Not Sent, Queued, Sending, Sent, or Failed"]
  );

  assert.deepEqual(
    validateBannerRow({
      StudentID: "A002",
      FirstName: "Dev",
      LastName: "Ram",
      Email: "dev@example.edu",
      Program: "Business",
      Campus: "City",
      AdmissionStatus: "Admitted",
      EmailStatus: "Sent",
      TemplateType: "UOFFER"
    }),
    ["SentDate is required when EmailStatus is Sent"]
  );

  assert.deepEqual(
    validateBannerRow({
      StudentID: "A003",
      FirstName: "Ana",
      LastName: "Pierre",
      Email: "ana@example.edu",
      Program: "Science",
      Campus: "City",
      AdmissionStatus: "Admitted",
      EmailStatus: "Failed",
      TemplateType: "UOFFER"
    }),
    ["ErrorMessage is required when EmailStatus is Failed"]
  );
});

test("readAdmissionsWorksheet normalizes and validates Banner TemplateType codes", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Admissions");
  sheet.addRow(["StudentID", "FirstName", "LastName", "Email", "Program", "Campus", "AdmissionStatus", "TemplateType"]);
  sheet.addRow(["A001", "Maya", "Singh", "maya@example.edu", "Nursing", "City", "Admitted", " uoffer "]);
  const result = await readAdmissionsWorksheet(Buffer.from(await workbook.xlsx.writeBuffer()));

  assert.equal(result.rows[0].TemplateType, "UOFFER");
  assert.deepEqual(validateBannerRow({ ...result.rows[0], TemplateType: "BAD TYPE!" }), [
    "TemplateType must contain only letters, numbers, underscores, or hyphens, and be 80 characters or fewer"
  ]);
});

test("rowToApplicantColumns can assign counselor-owned imports", () => {
  const { columns, values } = rowToApplicantColumns(
    {
      StudentID: "A001",
      FirstName: "Maya",
      LastName: "Singh",
      Email: "maya@example.edu",
      Program: "Nursing",
      Campus: "City",
      AdmissionStatus: "Admitted",
      TemplateType: "UOFFER"
    },
    "00000000-0000-0000-0000-000000000001",
    "11111111-1111-1111-1111-111111111111"
  );

  assert.equal(columns.at(-1), "counselor_user_id");
  assert.equal(values.at(-1), "11111111-1111-1111-1111-111111111111");
  assert.equal(values[columns.indexOf("validation_errors")], "[]");
  assert.equal((values[columns.indexOf("raw_data")] as Record<string, string>).StudentID, "A001");
});

test("upload route and UI only accept XLSX workbooks", async () => {
  const routeSource = await readFile("app/api/import/route.ts", "utf8");
  const clientSource = await readFile("components/app-client.tsx", "utf8");
  const readme = await readFile("README.md", "utf8");
  const windowsGuide = await readFile("docs/windows-vm-deployment.md", "utf8");

  assert.match(routeSource, /parseUploadFileName\(file\.name/);
  assert.match(routeSource, /allowedExtensions: \["\.xlsx"\]/);
  assert.match(routeSource, /Only \.xlsx Excel workbook uploads are allowed\./);
  assert.match(clientSource, /accept="\.xlsx"/);
  assert.match(readme, /Banner `\.xlsx` Excel export/);
  assert.match(windowsGuide, /legacy `\.xls` files are not accepted/);
});
