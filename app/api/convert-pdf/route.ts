import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { convertDocxToPdf } from "@/lib/pdf-converter";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { enforceApplicantOwnership, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const schema = z.object({
  generatedLetterId: z.string().uuid()
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor", "Counselor"]);
    const dbUser = await ensureDbUser(user);
    const body = schema.parse(await request.json());
    const result = await query<{ docx_storage_key: string; counselor_user_id: string | null; student_id: string }>(
      `SELECT gl.docx_storage_key, a.counselor_user_id, a.student_id
         FROM generated_letters gl
         JOIN applicants a ON a.id = gl.applicant_id
        WHERE gl.id = $1`,
      [body.generatedLetterId]
    );
    const letter = result.rows[0];
    if (!letter) return NextResponse.json({ error: "Generated letter not found." }, { status: 404 });
    enforceApplicantOwnership(user, dbUser.id, letter);

    const pdfStorageKey = await convertDocxToPdf(letter.docx_storage_key);
    await query("UPDATE generated_letters SET pdf_storage_key = $1, status = 'pdf_generated' WHERE id = $2", [
      pdfStorageKey,
      body.generatedLetterId
    ]);
    await audit("letter.converted_pdf", "generated_letters", {
      studentId: letter.student_id,
      generatedLetterId: body.generatedLetterId
    }, body.generatedLetterId, dbUser.id);
    return NextResponse.json({ pdfReady: true });
  } catch (error) {
    return handleApiError(error);
  }
}
