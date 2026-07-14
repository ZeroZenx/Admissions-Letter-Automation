import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { HttpError } from "../lib/auth";
import { parseUploadFileName } from "../lib/upload-file-names";

const excelOptions = {
  allowedExtensions: [".xlsx"],
  label: "Banner export",
  extensionError: "Only .xlsx Excel workbook uploads are allowed."
};

test("upload file names are bounded and extension checked", () => {
  assert.equal(parseUploadFileName(" Admissions_Banner_Export.xlsx ", excelOptions), "Admissions_Banner_Export.xlsx");
  assert.throws(
    () => parseUploadFileName("Admissions_Banner_Export.xls", excelOptions),
    (error) =>
      error instanceof HttpError &&
      error.status === 400 &&
      error.message === "Only .xlsx Excel workbook uploads are allowed."
  );
  assert.throws(
    () => parseUploadFileName("../Admissions_Banner_Export.xlsx", excelOptions),
    (error) => error instanceof HttpError && error.status === 400 && error.message.includes("path separators")
  );
  assert.throws(
    () => parseUploadFileName(`A${"\n"}B.xlsx`, excelOptions),
    (error) => error instanceof HttpError && error.status === 400 && error.message.includes("control characters")
  );
  assert.throws(
    () => parseUploadFileName(`${"A".repeat(251)}.xlsx`, excelOptions),
    (error) => error instanceof HttpError && error.status === 400 && error.message.includes("255 characters")
  );
});

test("upload routes validate persisted original filenames", async () => {
  const importSource = await readFile("app/api/import/route.ts", "utf8");
  const templateSource = await readFile("app/api/templates/route.ts", "utf8");
  const detectSource = await readFile("app/api/templates/detect-placeholders/route.ts", "utf8");
  const checklist = await readFile("docs/production-readiness.md", "utf8");

  assert.match(importSource, /const fileName = parseUploadFileName\(file\.name/);
  assert.match(importSource, /allowedExtensions: \["\.xlsx"\]/);
  assert.match(importSource, /await saveBuffer\("imports", fileName, buffer\)/);
  assert.match(importSource, /uploadedFileName: fileName/);
  assert.match(templateSource, /const fileName = parseUploadFileName\(file\.name/);
  assert.match(templateSource, /allowedExtensions: \["\.docx"\]/);
  assert.match(templateSource, /await saveBuffer\("templates", fileName, buffer\)/);
  assert.match(templateSource, /originalFileName: fileName/);
  assert.match(detectSource, /parseUploadFileName\(file\.name/);
  assert.match(checklist, /Uploaded Excel and DOCX filenames are limited to 255 characters/);
});
