import { query } from "@/lib/db";

export async function audit(action: string, entityType: string, details: Record<string, unknown>, entityId?: string) {
  await query(
    `INSERT INTO audit_logs (action, entity_type, entity_id, applicant_student_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [action, entityType, entityId ?? null, details.studentId ?? null, details]
  );
}
