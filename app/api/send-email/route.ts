import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { HttpError, requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendGraphMail } from "@/lib/graph-mail";
import { handleApiError } from "@/lib/http";
import { uploadLimits, formatBytes } from "@/lib/request-limits";
import { sanitizeEmailHtml } from "@/lib/sanitize";
import { readStorageBuffer } from "@/lib/storage";
import { enforceApplicantOwnership, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const schema = z.object({
  generatedLetterId: z.string().uuid(),
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(12000),
  resendReason: z.string().trim().max(1000).optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor", "Counselor"]);
    const dbUser = await ensureDbUser(user);
    const graphAccessToken = request.headers.get("x-graph-access-token") ?? user.accessToken;
    if (!graphAccessToken) {
      throw new HttpError(401, "Microsoft Graph email sending requires a delegated Graph bearer token.");
    }

    const body = schema.parse(await request.json());
    const letterResult = await query<{
      applicant_id: string;
      pdf_storage_key: string | null;
      student_id: string;
      email: string;
      first_name: string;
      last_name: string;
      counselor_user_id: string | null;
    }>(
      `SELECT gl.applicant_id, gl.pdf_storage_key, a.student_id, a.email, a.first_name, a.last_name, a.counselor_user_id
         FROM generated_letters gl
         JOIN applicants a ON a.id = gl.applicant_id
        WHERE gl.id = $1`,
      [body.generatedLetterId]
    );
    const letter = letterResult.rows[0];
    if (!letter) return NextResponse.json({ error: "Generated letter not found." }, { status: 404 });
    enforceApplicantOwnership(user, dbUser.id, letter);
    if (!letter.pdf_storage_key) return NextResponse.json({ error: "Generate the PDF before sending email." }, { status: 400 });

    const previousSendResult = await query<{ id: string; status: "pending" | "sent" }>(
      `SELECT id, status FROM email_logs
        WHERE generated_letter_id = $1 AND status IN ('pending', 'sent')
        ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC
        LIMIT 1`,
      [body.generatedLetterId]
    );
    const previousSend = previousSendResult.rows[0];
    if (previousSend?.status === "pending") {
      return NextResponse.json({ error: "This letter is already being sent. Wait for the pending send to finish before trying again." }, { status: 409 });
    }
    if (previousSend?.status === "sent" && !body.resendReason) {
      return NextResponse.json({ error: "This letter was already sent. Provide a resend reason to send again." }, { status: 409 });
    }

    const pdf = await readStorageBuffer(letter.pdf_storage_key);
    if (pdf.byteLength > uploadLimits.pdfAttachmentBytes) {
      return NextResponse.json(
        { error: `Generated PDF exceeds the ${formatBytes(uploadLimits.pdfAttachmentBytes)} email attachment limit.` },
        { status: 413 }
      );
    }
    const sanitizedBody = sanitizeEmailHtml(body.body);
    const emailLog = await query<{ id: string }>(
      `INSERT INTO email_logs (applicant_id, generated_letter_id, recipient, subject, body, status, sent_at, resend_reason, sent_by)
       VALUES ($1, $2, $3, $4, $5, 'pending', null, $6, $7)
       RETURNING id`,
      [letter.applicant_id, body.generatedLetterId, letter.email, body.subject, sanitizedBody, body.resendReason ?? null, dbUser.id]
    );

    await query("UPDATE applicants SET email_status = 'Sending' WHERE id = $1", [letter.applicant_id]);

    try {
      await sendGraphMail({
        accessToken: graphAccessToken,
        recipient: letter.email,
        subject: body.subject,
        body: sanitizedBody,
        attachmentName: `${letter.student_id}-admissions-letter.pdf`,
        attachmentContent: pdf
      });

      await query("UPDATE email_logs SET status = 'sent', sent_at = now() WHERE id = $1", [emailLog.rows[0].id]);
      await query("UPDATE applicants SET email_status = 'Sent', sent_date = now() WHERE id = $1", [letter.applicant_id]);
      await audit("email.sent", "email_logs", {
        studentId: letter.student_id,
        recipient: letter.email,
        generatedLetterId: body.generatedLetterId,
        resend: Boolean(body.resendReason)
      }, emailLog.rows[0].id, dbUser.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown Graph send failure";
      await query("UPDATE email_logs SET status = 'failed', error_message = $1 WHERE id = $2", [errorMessage, emailLog.rows[0].id]);
      await query("UPDATE applicants SET email_status = 'Failed', error_message = $1 WHERE id = $2", [errorMessage, letter.applicant_id]);
      await audit("email.failed", "email_logs", {
        studentId: letter.student_id,
        recipient: letter.email,
        generatedLetterId: body.generatedLetterId,
        error: errorMessage
      }, emailLog.rows[0].id, dbUser.id);
      throw error;
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    return handleApiError(error);
  }
}
