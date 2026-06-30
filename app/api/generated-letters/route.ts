import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { counselorApplicantWhereClause, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const dbUser = await ensureDbUser(user);
    const ownership = counselorApplicantWhereClause(user, dbUser.id, 1);
    const result = await query(
      `SELECT gl.id, gl.status, gl.generated_at, gl.pdf_storage_key IS NOT NULL AS pdf_ready,
              a.student_id, a.first_name, a.last_name, a.email, a.program, a.template_type
         FROM generated_letters gl
         JOIN applicants a ON a.id = gl.applicant_id
         ${ownership.clause ? `WHERE ${ownership.clause}` : ""}
         ORDER BY gl.generated_at DESC
         LIMIT 200`,
      ownership.params
    );
    return NextResponse.json({ generatedLetters: result.rows });
  } catch (error) {
    return handleApiError(error);
  }
}
