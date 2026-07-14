import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { HttpError } from "../lib/auth";
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

test("upload route and UI only accept XLSX workbooks", async () => {
  const routeSource = await readFile("app/api/import/route.ts", "utf8");
  const clientSource = await readFile("components/app-client.tsx", "utf8");
  const readme = await readFile("README.md", "utf8");
  const windowsGuide = await readFile("docs/windows-vm-deployment.md", "utf8");

  assert.match(routeSource, /\/\\\.xlsx\$\/i/);
  assert.match(routeSource, /Only \.xlsx Excel workbook uploads are allowed\./);
  assert.match(clientSource, /accept="\.xlsx"/);
  assert.match(readme, /Banner `\.xlsx` Excel export/);
  assert.match(windowsGuide, /legacy `\.xls` files are not accepted/);
});
