import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { listLimits, readPaginationParams } from "@/lib/request-limits";
import { counselorApplicantWhereClause, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const filtersSchema = z.object({
  generatedLetterId: z.string().uuid().optional(),
  applicantId: z.string().uuid().optional(),
  status: z.enum(["pending", "sent", "failed"]).optional()
});

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor", "Counselor", "Viewer"]);
    const dbUser = await ensureDbUser(user);
    const url = new URL(request.url);
    const page = readPaginationParams(url, { defaultLimit: listLimits.emailLogs, maxLimit: listLimits.emailLogs });
    const filters = filtersSchema.parse({
      generatedLetterId: url.searchParams.get("generatedLetterId") || undefined,
      applicantId: url.searchParams.get("applicantId") || undefined,
      status: url.searchParams.get("status") || undefined
    });

    const where: string[] = [];
    const params: unknown[] = [];
    const ownership = counselorApplicantWhereClause(user, dbUser.id, params.length + 1);
    if (ownership.clause) {
      where.push(ownership.clause);
      params.push(...ownership.params);
    }
    if (filters.generatedLetterId) {
      params.push(filters.generatedLetterId);
      where.push(`el.generated_letter_id = $${params.length}`);
    }
    if (filters.applicantId) {
      params.push(filters.applicantId);
      where.push(`el.applicant_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      where.push(`el.status = $${params.length}`);
    }

    const result = await query(
      `SELECT el.id, el.generated_letter_id, el.applicant_id, el.recipient, el.subject,
              el.status, el.sent_at, el.resend_reason, el.error_message, el.created_at,
              a.student_id, a.first_name, a.last_name, a.template_type
         FROM email_logs el
         JOIN applicants a ON a.id = el.applicant_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY el.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page.limit, page.offset]
    );

    return NextResponse.json({ emailLogs: result.rows, page });
  } catch (error) {
    return handleApiError(error);
  }
}
