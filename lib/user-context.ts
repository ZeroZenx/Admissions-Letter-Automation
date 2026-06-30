import { HttpError, type AuthenticatedUser } from "@/lib/auth";
import { query } from "@/lib/db";

export type DbUser = {
  id: string;
  entra_oid: string | null;
  email: string;
  display_name: string;
  role: string;
};

export async function ensureDbUser(user: AuthenticatedUser) {
  const role = user.roles[0] ?? "Viewer";
  const result = await query<DbUser>(
    `INSERT INTO users (entra_oid, email, display_name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET
       entra_oid = COALESCE(users.entra_oid, EXCLUDED.entra_oid),
       display_name = EXCLUDED.display_name,
       role = EXCLUDED.role
     RETURNING id, entra_oid, email, display_name, role`,
    [user.id, user.email, user.displayName, role]
  );
  return result.rows[0];
}

export function enforceApplicantOwnership(
  user: AuthenticatedUser,
  dbUserId: string,
  applicant: { counselor_user_id?: unknown; student_id?: unknown }
) {
  if (!user.roles.includes("Counselor")) return;
  if (!applicant.counselor_user_id) return;
  if (String(applicant.counselor_user_id) === dbUserId) return;
  throw new HttpError(403, `Applicant ${String(applicant.student_id ?? "")} is assigned to another counselor.`);
}

export function counselorApplicantWhereClause(user: AuthenticatedUser, dbUserId: string, startParamIndex: number) {
  if (!user.roles.includes("Counselor")) return { clause: "", params: [] as string[] };
  return {
    clause: `(counselor_user_id IS NULL OR counselor_user_id = $${startParamIndex})`,
    params: [dbUserId]
  };
}
