import ExcelJS from "exceljs";
import { applicantFilterClauses, readApplicantFilters } from "@/lib/applicant-filters";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { bannerFields, bannerToDbField } from "@/lib/banner-fields";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { uploadLimits } from "@/lib/limits";
import { counselorApplicantWhereClause, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const dateFields = new Set(["DateGenerated", "BirthDate", "SentDate"]);

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const dbUser = await ensureDbUser(user);
    const url = new URL(request.url);
    const clauses: string[] = [];
    const params: unknown[] = [];
    const filters = readApplicantFilters(url);

    clauses.push(...applicantFilterClauses(filters, params));
    const ownership = counselorApplicantWhereClause(user, dbUser.id, params.length + 1);
    if (ownership.clause) {
      clauses.push(ownership.clause);
      params.push(...ownership.params);
    }

    const countResult = await query<{ count: string }>(
      `SELECT count(*) AS count
         FROM applicants
         ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}`,
      params
    );
    const exportCount = Number(countResult.rows[0]?.count ?? 0);
    if (exportCount > uploadLimits.statusExportRows) {
      return Response.json(
        {
          error: `Status export includes ${exportCount} rows, which exceeds the ${uploadLimits.statusExportRows} row export limit. Apply filters before exporting.`
        },
        { status: 413 }
      );
    }

    const dbColumns = bannerFields.map((field) => bannerToDbField[field]);
    const result = await query<Record<string, unknown>>(
      `SELECT ${dbColumns.join(", ")}
         FROM applicants
         ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
         ORDER BY created_at DESC`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "COSTAATT Admissions Letter Automation";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Admissions");
    worksheet.columns = bannerFields.map((field) => ({ header: field, key: field, width: Math.max(14, field.length + 2) }));
    worksheet.getRow(1).font = { bold: true };
    worksheet.autoFilter = {
      from: "A1",
      to: `${excelColumnLetter(bannerFields.length)}1`
    };
    for (const field of dateFields) {
      worksheet.getColumn(field).numFmt = "yyyy-mm-dd";
    }

    for (const row of result.rows) {
      worksheet.addRow(Object.fromEntries(bannerFields.map((field) => [field, exportValue(field, row[bannerToDbField[field]])])));
    }
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    await audit("applicants.exported", "applicants", {
      exportedCount: result.rows.length,
      filters
    }, undefined, dbUser.id);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="costaatt-admissions-status-export.xlsx"`
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
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
