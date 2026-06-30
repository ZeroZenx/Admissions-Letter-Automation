import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { readAdmissionsWorksheet, validateBannerRow } from "../lib/import-excel";

test("readAdmissionsWorksheet reads the Admissions worksheet and normalizes known Banner fields", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Admissions");
  sheet.addRow(["StudentID", "FirstName", "LastName", "Email", "Program", "Campus", "AdmissionStatus", "TemplateType"]);
  sheet.addRow(["A001", "Maya", "Singh", "maya@example.edu", "Nursing", "City", "Admitted", "UOFFER"]);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const result = await readAdmissionsWorksheet(buffer);

  assert.equal(result.worksheetName, "Admissions");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].StudentID, "A001");
  assert.equal(result.rows[0].Program, "Nursing");
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
