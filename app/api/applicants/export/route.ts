import { applicantFilterClauses, readApplicantFilters } from "@/lib/applicant-filters";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { uploadLimits } from "@/lib/limits";
import { applicantStatusExportColumns, buildApplicantStatusWorkbook } from "@/lib/status-export";
import { counselorApplicantWhereClause, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const dbUser = await ensureDbUser(user);
    const url = new URL(request.url);
    const clauses: string[] = [];
    const params: unknown[] = [];
    const filters = readApplicantFilters(url);

    clauses.push("EXISTS (SELECT 1 FROM imports i WHERE i.id = applicants.import_id AND i.archived_at IS NULL)");
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

    const dbColumns = applicantStatusExportColumns();
    const result = await query<Record<string, unknown>>(
      `SELECT ${dbColumns.join(", ")}
         FROM applicants
         ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
         ORDER BY created_at DESC`,
      params
    );

    await audit("applicants.exported", "applicants", {
      exportedCount: result.rows.length,
      filters
    }, undefined, dbUser.id);

    const workbook = await buildApplicantStatusWorkbook(result.rows);
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
