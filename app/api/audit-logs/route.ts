import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAuth(request, ["Admin", "Admissions Supervisor"]);
    const result = await query(
      `SELECT id, action, entity_type, entity_id, applicant_student_id, details, created_at
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT 500`
    );
    return NextResponse.json({ auditLogs: result.rows });
  } catch (error) {
    return handleApiError(error);
  }
}
