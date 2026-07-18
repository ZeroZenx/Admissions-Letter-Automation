import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { listLimits, readPaginationParams } from "@/lib/request-limits";
import { parseTemplateType } from "@/lib/template-types";
import { counselorApplicantWhereClause, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const dbUser = await ensureDbUser(user);
    const url = new URL(request.url);
    const page = readPaginationParams(url, {
      defaultLimit: listLimits.generatedLetters,
      maxLimit: listLimits.generatedLetters
    });
    const ownership = counselorApplicantWhereClause(user, dbUser.id, 1);
    const templateTypeInput = url.searchParams.get("templateType")?.trim();
    const templateType = templateTypeInput ? parseTemplateType(templateTypeInput) : null;
    const params: unknown[] = [...ownership.params];
    const clauses = [
      "EXISTS (SELECT 1 FROM imports i WHERE i.id = a.import_id AND i.archived_at IS NULL)",
      ...(ownership.clause ? [ownership.clause] : [])
    ];
    if (templateType) {
      params.push(templateType);
      clauses.push(`a.template_type = $${params.length}`);
    }
    params.push(page.limit, page.offset);
    const result = await query(
      `SELECT gl.id, gl.status, gl.generated_at, gl.pdf_storage_key IS NOT NULL AS pdf_ready,
              a.student_id, a.first_name, a.last_name, a.email, a.program, a.template_type,
              a.word_file_name, a.pdf_file_name
         FROM generated_letters gl
         JOIN applicants a ON a.id = gl.applicant_id
         WHERE ${clauses.join(" AND ")}
         ORDER BY gl.generated_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return NextResponse.json({ generatedLetters: result.rows, page });
  } catch (error) {
    return handleApiError(error);
  }
}
