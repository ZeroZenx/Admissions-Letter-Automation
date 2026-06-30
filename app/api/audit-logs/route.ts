import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const result = await query(
    `SELECT id, action, entity_type, entity_id, applicant_student_id, details, created_at
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT 500`
  );
  return NextResponse.json({ auditLogs: result.rows });
}
