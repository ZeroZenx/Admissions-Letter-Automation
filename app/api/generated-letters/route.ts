import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const result = await query(
    `SELECT gl.id, gl.status, gl.generated_at, gl.pdf_storage_key IS NOT NULL AS pdf_ready,
            a.student_id, a.first_name, a.last_name, a.email, a.program, a.template_type
       FROM generated_letters gl
       JOIN applicants a ON a.id = gl.applicant_id
       ORDER BY gl.generated_at DESC
       LIMIT 200`
  );
  return NextResponse.json({ generatedLetters: result.rows });
}
