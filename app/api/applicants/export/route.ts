import ExcelJS from "exceljs";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { bannerFields, bannerToDbField } from "@/lib/banner-fields";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { counselorApplicantWhereClause, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const filterColumns: Record<string, string> = {
  templateType: "template_type",
  admissionStatus: "admission_status",
  emailStatus: "email_status",
  campus: "campus",
  program: "program"
};

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const dbUser = await ensureDbUser(user);
    const url = new URL(request.url);
    const clauses: string[] = [];
    const params: string[] = [];

    for (const [param, column] of Object.entries(filterColumns)) {
      const value = url.searchParams.get(param);
      if (value) {
        params.push(value);
        clauses.push(`${column} = $${params.length}`);
      }
    }
    const ownership = counselorApplicantWhereClause(user, dbUser.id, params.length + 1);
    if (ownership.clause) {
      clauses.push(ownership.clause);
      params.push(...ownership.params);
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

    for (const row of result.rows) {
      worksheet.addRow(Object.fromEntries(bannerFields.map((field) => [field, exportValue(row[bannerToDbField[field]])])));
    }
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    await audit("applicants.exported", "applicants", {
      exportedCount: result.rows.length,
      filters: Object.fromEntries(url.searchParams.entries())
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

function exportValue(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}
