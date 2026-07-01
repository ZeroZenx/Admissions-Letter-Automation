import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAuth(request, ["Admin", "Admissions Supervisor"]);
    const result = await query(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.applicant_student_id, al.details, al.created_at,
              u.display_name AS actor_name, u.email AS actor_email
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ORDER BY al.created_at DESC
         LIMIT 500`
    );
    return NextResponse.json({ auditLogs: result.rows });
  } catch (error) {
    return handleApiError(error);
  }
}
