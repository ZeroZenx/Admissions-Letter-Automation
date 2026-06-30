import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import PizZip from "pizzip";
import { generateDocxFromTemplate } from "../lib/docx-generate";
import { readAdmissionsWorksheet, rowToApplicantColumns, validateBannerRow } from "../lib/import-excel";
import { buildLetterValues } from "../lib/letter-values";

test("Banner row can be parsed, mapped, and merged into a DOCX template", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Admissions");
  sheet.addRow(["StudentID", "FirstName", "MiddleName", "LastName", "Email", "Program", "Campus", "AdmissionStatus", "TemplateType"]);
  sheet.addRow(["A1001", "Leah", "M", "Joseph", "leah@example.edu", "Associate Nursing", "South", "Admitted", "UOFFER"]);

  const workbookBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const parsed = await readAdmissionsWorksheet(workbookBuffer);
  const row = parsed.rows[0];

  assert.deepEqual(validateBannerRow(row), []);

  const { columns, values } = rowToApplicantColumns(row, "00000000-0000-0000-0000-000000000001");
  const applicant = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
  const letterValues = buildLetterValues(applicant, [
    { placeholder: "ApplicantName", banner_field: "FullName", fallback_value: null },
    { placeholder: "ProgrammeName", banner_field: "Program", fallback_value: null }
  ]);

  const templateZip = new PizZip();
  templateZip.file(
    "word/document.xml",
    "<w:document><w:t>{{ApplicantName}}</w:t><w:t>«StudentID»</w:t><w:t>{{ProgrammeName}}</w:t></w:document>"
  );

  const output = generateDocxFromTemplate(templateZip.generate({ type: "nodebuffer" }), letterValues);
  const xml = new PizZip(output).file("word/document.xml")?.asText() ?? "";

  assert.match(xml, /Leah M Joseph/);
  assert.match(xml, /A1001/);
  assert.match(xml, /Associate Nursing/);
});
