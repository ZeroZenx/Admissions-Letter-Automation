import { NextResponse } from "next/server";
import { applicantFilterClauses, readApplicantFilters } from "@/lib/applicant-filters";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { listLimits, readPaginationParams } from "@/lib/request-limits";
import { counselorApplicantWhereClause, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const dbUser = await ensureDbUser(user);
    const url = new URL(request.url);
    const clauses: string[] = [];
    const params: unknown[] = [];
    const page = readPaginationParams(url, { defaultLimit: listLimits.applicants, maxLimit: listLimits.applicants });

    clauses.push("EXISTS (SELECT 1 FROM imports i WHERE i.id = applicants.import_id AND i.archived_at IS NULL)");
    clauses.push(...applicantFilterClauses(readApplicantFilters(url), params));
    const ownership = counselorApplicantWhereClause(user, dbUser.id, params.length + 1);
    if (ownership.clause) {
      clauses.push(ownership.clause);
      params.push(...ownership.params);
    }

    const result = await query(
      `SELECT id, student_id, first_name, middle_name, last_name, email, campus, program,
              admission_status, email_status, sent_date, word_file_name, pdf_file_name,
              error_message, processed_by_flow, template_type, validation_errors, created_at
         FROM applicants
         ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page.limit, page.offset]
    );

    return NextResponse.json({ applicants: result.rows, page });
  } catch (error) {
    return handleApiError(error);
  }
}
