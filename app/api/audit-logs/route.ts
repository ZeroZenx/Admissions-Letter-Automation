import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAuth(request, ["Admin", "Admissions Supervisor"]);
    const result = await query<{
      id: string;
      action: string;
      entity_type: string;
      entity_id: string | null;
      applicant_student_id: string | null;
      details: unknown;
      created_at: string;
      actor_name: string | null;
      actor_email: string | null;
    }>(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.applicant_student_id, al.details, al.created_at,
              u.display_name AS actor_name, u.email AS actor_email
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ORDER BY al.created_at DESC
         LIMIT 500`
    );
    return NextResponse.json({
      auditLogs: result.rows.map((row) => ({
        ...row,
        details: sanitizeAuditDetails(row.details)
      }))
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function sanitizeAuditDetails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditDetails);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, detail]) => [
        key,
        isSensitiveAuditKey(key) ? "[redacted]" : sanitizeAuditDetails(detail)
      ])
    );
  }
  if (typeof value === "string") return redactSensitiveAuditText(value);
  return value;
}

function isSensitiveAuditKey(key: string) {
  return /(access)?token|authorization|body|content|attachment|storage_?key|path/i.test(key);
}

function redactSensitiveAuditText(value: string) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[redacted-database-url]")
    .replace(/[A-Z]:[\\/][^\s"'<>]+/g, "[redacted-path]")
    .replace(/\/(?:Users|var|private|tmp|app|srv|opt|etc|home)\/[^\s"'<>]+/g, "[redacted-path]");
}
