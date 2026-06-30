import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
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

    const result = await query(
      `SELECT id, student_id, first_name, middle_name, last_name, email, campus, program,
              admission_status, email_status, template_type, validation_errors, created_at
         FROM applicants
         ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
         ORDER BY created_at DESC
         LIMIT 500`,
      params
    );

    return NextResponse.json({ applicants: result.rows });
  } catch (error) {
    return handleApiError(error);
  }
}
