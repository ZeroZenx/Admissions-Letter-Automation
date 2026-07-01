import ExcelJS from "exceljs";
import { HttpError } from "@/lib/auth";
import { bannerFields, bannerToDbField, requiredBannerFields } from "@/lib/banner-fields";

export type ImportRow = Record<string, string>;

export async function readAdmissionsWorksheet(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets.find((sheet) => sheet.name.trim().toLowerCase() === "admissions");
  if (!worksheet) {
    throw new HttpError(400, "The workbook must include a worksheet named Admissions.");
  }

  const headerRow = worksheet.getRow(1);
  const headers = new Map<number, string>();
  headerRow.eachCell((cell, columnNumber) => {
    headers.set(columnNumber, String(cell.value ?? "").trim());
  });

  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, unknown> = {};
    headers.forEach((header, columnNumber) => {
      record[header] = cellToString(row.getCell(columnNumber).value);
    });
    if (Object.values(record).some((value) => String(value).trim())) rows.push(record);
  });

  return {
    worksheetName: worksheet.name,
    rows: rows.map(normalizeRow)
  };
}

function cellToString(value: ExcelJS.CellValue) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value) return String(value.text ?? "");
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
  }
  return String(value);
}

function normalizeRow(row: Record<string, unknown>): ImportRow {
  const normalized: ImportRow = {};
  for (const field of bannerFields) {
    const value = row[field];
    normalized[field] = value == null ? "" : String(value).trim();
  }
  return normalized;
}

export function validateBannerRow(row: ImportRow) {
  return requiredBannerFields
    .filter((field) => !row[field]?.trim())
    .map((field) => `${field} is required`);
}

export function rowToApplicantColumns(row: ImportRow, importId: string) {
  const columns = ["import_id"];
  const values: unknown[] = [importId];

  for (const field of bannerFields) {
    const dbField = bannerToDbField[field];
    columns.push(dbField);
    if (field === "ProcessedByFlow") {
      values.push(["true", "yes", "1"].includes(row[field].toLowerCase()));
    } else if (field === "SentDate" && !row[field]) {
      values.push(null);
    } else if (field === "EmailStatus" && !row[field]) {
      values.push("Not Sent");
    } else {
      values.push(row[field] || null);
    }
  }

  columns.push("raw_data", "validation_errors");
  values.push(row, validateBannerRow(row));

  return { columns, values };
}
