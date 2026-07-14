import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { convertDocxToPdf } from "@/lib/pdf-converter";
import { letterDownloadFileName } from "@/lib/download-filenames";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { storageFileExists } from "@/lib/storage";
import { enforceApplicantOwnership, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const schema = z.object({
  generatedLetterId: z.string().uuid()
});

export async function POST(request: Request) {
  let dbUserId: string | undefined;
  let generatedLetterId: string | undefined;
  let failureLetter: {
    applicant_id: string;
    student_id: string;
    template_type: string;
  } | undefined;
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor", "Counselor"]);
    const dbUser = await ensureDbUser(user);
    dbUserId = dbUser.id;
    const body = schema.parse(await request.json());
    generatedLetterId = body.generatedLetterId;
    const result = await query<{
      applicant_id: string;
      docx_storage_key: string;
      counselor_user_id: string | null;
      student_id: string;
      template_type: string;
    }>(
      `SELECT gl.applicant_id, gl.docx_storage_key, a.counselor_user_id, a.student_id, a.template_type
         FROM generated_letters gl
         JOIN applicants a ON a.id = gl.applicant_id
        WHERE gl.id = $1`,
      [body.generatedLetterId]
    );
    const letter = result.rows[0];
    if (!letter) return NextResponse.json({ error: "Generated letter not found." }, { status: 404 });
    failureLetter = letter;
    enforceApplicantOwnership(user, dbUser.id, letter);

    if (!(await storageFileExists(letter.docx_storage_key))) {
      throw new Error("Generated DOCX file was not found in storage. Regenerate the letter before converting to PDF.");
    }

    const pdfStorageKey = await convertDocxToPdf(letter.docx_storage_key);
    const pdfFileName = letterDownloadFileName(letter.student_id, letter.template_type, "pdf");
    await query("UPDATE generated_letters SET pdf_storage_key = $1, status = 'pdf_generated', error_message = null WHERE id = $2", [
      pdfStorageKey,
      body.generatedLetterId
    ]);
    await query("UPDATE applicants SET pdf_file_name = $1, error_message = null, processed_by_flow = true WHERE id = $2", [
      pdfFileName,
      letter.applicant_id
    ]);
    await audit("letter.converted_pdf", "generated_letters", {
      studentId: letter.student_id,
      templateType: letter.template_type,
      generatedLetterId: body.generatedLetterId,
      pdfFileName
    }, body.generatedLetterId, dbUser.id);
    return NextResponse.json({ pdfReady: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown PDF conversion failure";
    if (generatedLetterId && failureLetter) {
      await query("UPDATE generated_letters SET status = 'failed', error_message = $1 WHERE id = $2", [
        errorMessage,
        generatedLetterId
      ]).catch(() => undefined);
      await query("UPDATE applicants SET error_message = $1, processed_by_flow = false WHERE id = $2", [
        errorMessage,
        failureLetter.applicant_id
      ]).catch(() => undefined);
      await audit("letter.failed", "generated_letters", {
        studentId: failureLetter.student_id,
        templateType: failureLetter.template_type,
        generatedLetterId,
        error: errorMessage
      }, generatedLetterId, dbUserId).catch(() => undefined);
    }
    return handleApiError(error);
  }
}
