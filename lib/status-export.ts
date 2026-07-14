import ExcelJS from "exceljs";
import { statusExportFields, statusExportToDbField } from "@/lib/banner-fields";

const dateFields = new Set(["DateGenerated", "BirthDate", "SentDate"]);

export async function buildApplicantStatusWorkbook(rows: Record<string, unknown>[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "COSTAATT Admissions Letter Automation";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Admissions");
  worksheet.columns = statusExportFields.map((field) => ({ header: field, key: field, width: Math.max(14, field.length + 2) }));
  worksheet.getRow(1).font = { bold: true };
  worksheet.autoFilter = {
    from: "A1",
    to: `${excelColumnLetter(statusExportFields.length)}1`
  };
  for (const field of dateFields) {
    worksheet.getColumn(field).numFmt = "yyyy-mm-dd";
  }

  for (const row of rows) {
    worksheet.addRow(Object.fromEntries(statusExportFields.map((field) => [field, exportValue(field, row[statusExportToDbField[field]])])));
  }
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  return workbook;
}

export function applicantStatusExportColumns() {
  return [...new Set(statusExportFields.map((field) => statusExportToDbField[field]))];
}

function exportValue(field: string, value: unknown) {
  if (value == null) return "";
  if (dateFields.has(field)) return exportDateValue(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function exportDateValue(value: unknown) {
  if (value instanceof Date) return value;
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return text;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function excelColumnLetter(columnNumber: number) {
  let column = columnNumber;
  let letter = "";
  while (column > 0) {
    const remainder = (column - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    column = Math.floor((column - 1) / 26);
  }
  return letter;
}
