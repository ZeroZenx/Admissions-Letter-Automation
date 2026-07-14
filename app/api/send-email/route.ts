import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { HttpError, requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { letterDownloadFileName } from "@/lib/download-filenames";
import { getAuthEnv } from "@/lib/env";
import { sendGraphMail } from "@/lib/graph-mail";
import { handleApiError } from "@/lib/http";
import { uploadLimits, formatBytes } from "@/lib/request-limits";
import { sanitizeEmailHtml } from "@/lib/sanitize";
import { getAppSettings } from "@/lib/settings";
import { readStorageBuffer, storageFileExists } from "@/lib/storage";
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
    const authEnv = getAuthEnv();
    const graphAccessToken = request.headers.get("x-graph-access-token") ?? user.accessToken;
    if (authEnv.AUTH_MODE !== "development" && !graphAccessToken) {
      throw new HttpError(401, "Microsoft Graph email sending requires a delegated Graph bearer token.");
    }

    const body = schema.parse(await request.json());
    const letterResult = await query<{
      applicant_id: string;
      pdf_storage_key: string | null;
      student_id: string;
      template_type: string;
      email: string;
      first_name: string;
      last_name: string;
      counselor_user_id: string | null;
    }>(
      `SELECT gl.applicant_id, gl.pdf_storage_key, a.student_id, a.template_type, a.email, a.first_name, a.last_name, a.counselor_user_id
         FROM generated_letters gl
         JOIN applicants a ON a.id = gl.applicant_id
        WHERE gl.id = $1`,
      [body.generatedLetterId]
    );
    const letter = letterResult.rows[0];
    if (!letter) return NextResponse.json({ error: "Generated letter not found." }, { status: 404 });
    enforceApplicantOwnership(user, dbUser.id, letter);
    if (!letter.pdf_storage_key) {
      const errorMessage = "Generate the PDF before sending email.";
      await query("UPDATE applicants SET email_status = 'Failed', error_message = $1 WHERE id = $2", [
        errorMessage,
        letter.applicant_id
      ]);
      await audit("email.blocked_pdf_not_generated", "applicants", {
        studentId: letter.student_id,
        recipient: letter.email,
        generatedLetterId: body.generatedLetterId,
        error: errorMessage
      }, letter.applicant_id, dbUser.id).catch(() => undefined);
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const settings = await getAppSettings();
    const stalePendingMessage = "Pending email send timed out before completion.";
    const stalePendingResult = await query<{ id: string }>(
      `UPDATE email_logs
          SET status = 'failed', error_message = $3
        WHERE applicant_id = $1
          AND status = 'pending'
          AND resend_reason IS NULL
          AND created_at < now() - ($2::int * interval '1 minute')
        RETURNING id`,
      [letter.applicant_id, settings.email.stalePendingMinutes, stalePendingMessage]
    );
    if (stalePendingResult.rowCount) {
      await query("UPDATE applicants SET email_status = 'Failed', error_message = $1 WHERE id = $2", [
        stalePendingMessage,
        letter.applicant_id
      ]);
    }
    for (const stalePending of stalePendingResult.rows) {
      await audit("email.stale_failed", "email_logs", {
        studentId: letter.student_id,
        recipient: letter.email,
        generatedLetterId: body.generatedLetterId,
        error: stalePendingMessage
      }, stalePending.id, dbUser.id).catch(() => undefined);
    }

    const previousSendResult = await query<{ id: string; status: "pending" | "sent" }>(
      `SELECT id, status FROM email_logs
        WHERE applicant_id = $1 AND status IN ('pending', 'sent') AND resend_reason IS NULL
        ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC
        LIMIT 1`,
      [letter.applicant_id]
    );
    const previousSend = previousSendResult.rows[0];
    if (previousSend?.status === "pending") {
      return NextResponse.json({ error: "This letter is already being sent. Wait for the pending send to finish before trying again." }, { status: 409 });
    }
    if (previousSend?.status === "sent" && !body.resendReason) {
      return NextResponse.json({ error: "This letter was already sent. Provide a resend reason to send again." }, { status: 409 });
    }

    if (!(await storageFileExists(letter.pdf_storage_key))) {
      const errorMessage = "Generated PDF file was not found in storage. Regenerate the letter before sending email.";
      await query("UPDATE applicants SET email_status = 'Failed', error_message = $1 WHERE id = $2", [
        errorMessage,
        letter.applicant_id
      ]);
      await audit("email.blocked_missing_pdf", "applicants", {
        studentId: letter.student_id,
        recipient: letter.email,
        generatedLetterId: body.generatedLetterId,
        error: errorMessage
      }, letter.applicant_id, dbUser.id).catch(() => undefined);
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    const pdf = await readStorageBuffer(letter.pdf_storage_key);
    if (pdf.byteLength > uploadLimits.pdfAttachmentBytes) {
      const errorMessage = `Generated PDF exceeds the ${formatBytes(uploadLimits.pdfAttachmentBytes)} email attachment limit.`;
      await query("UPDATE applicants SET email_status = 'Failed', error_message = $1 WHERE id = $2", [
        errorMessage,
        letter.applicant_id
      ]);
      await audit("email.blocked_oversized_pdf", "applicants", {
        studentId: letter.student_id,
        recipient: letter.email,
        generatedLetterId: body.generatedLetterId,
        error: errorMessage
      }, letter.applicant_id, dbUser.id).catch(() => undefined);
      return NextResponse.json({ error: errorMessage }, { status: 413 });
    }
    const sanitizedBody = sanitizeEmailHtml(body.body);
    const emailLog = await query<{ id: string }>(
      `INSERT INTO email_logs (applicant_id, generated_letter_id, recipient, subject, body, status, sent_at, resend_reason, sent_by)
       VALUES ($1, $2, $3, $4, $5, 'pending', null, $6, $7)
       RETURNING id`,
      [letter.applicant_id, body.generatedLetterId, letter.email, body.subject, sanitizedBody, body.resendReason ?? null, dbUser.id]
    );

    await query("UPDATE applicants SET email_status = 'Queued', sent_date = null, error_message = null WHERE id = $1", [letter.applicant_id]);
    try {
      await audit("email.queued", "email_logs", {
        studentId: letter.student_id,
        recipient: letter.email,
        generatedLetterId: body.generatedLetterId,
        resend: Boolean(body.resendReason)
      }, emailLog.rows[0].id, dbUser.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Email queue audit failed.";
      await query("UPDATE email_logs SET status = 'failed', error_message = $1 WHERE id = $2", [errorMessage, emailLog.rows[0].id]).catch(() => undefined);
      await query("UPDATE applicants SET email_status = 'Failed', error_message = $1 WHERE id = $2", [errorMessage, letter.applicant_id]).catch(() => undefined);
      throw error;
    }

    try {
      await query("UPDATE applicants SET email_status = 'Sending', sent_date = null, error_message = null WHERE id = $1", [letter.applicant_id]);
      if (authEnv.AUTH_MODE !== "development") {
        if (!graphAccessToken) throw new HttpError(401, "Microsoft Graph email sending requires a delegated Graph bearer token.");
        await sendGraphMail({
          accessToken: graphAccessToken,
          recipient: letter.email,
          subject: body.subject,
          body: sanitizedBody,
          attachmentName: letterDownloadFileName(letter.student_id, letter.template_type, "pdf"),
          attachmentContent: pdf
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown Graph send failure";
      await query("UPDATE email_logs SET status = 'failed', error_message = $1 WHERE id = $2", [errorMessage, emailLog.rows[0].id]);
      await query("UPDATE applicants SET email_status = 'Failed', error_message = $1 WHERE id = $2", [errorMessage, letter.applicant_id]);
      await audit("email.failed", "email_logs", {
        studentId: letter.student_id,
        recipient: letter.email,
        generatedLetterId: body.generatedLetterId,
        error: errorMessage
      }, emailLog.rows[0].id, dbUser.id).catch(() => undefined);
      throw error;
    }

    await query("UPDATE email_logs SET status = 'sent', sent_at = now() WHERE id = $1", [emailLog.rows[0].id]);
    await query(
      "UPDATE applicants SET email_status = 'Sent', sent_date = now(), error_message = null, processed_by_flow = true WHERE id = $1",
      [letter.applicant_id]
    );

    let auditLogged = true;
    await audit("email.sent", "email_logs", {
      studentId: letter.student_id,
      recipient: letter.email,
      generatedLetterId: body.generatedLetterId,
      resend: Boolean(body.resendReason)
    }, emailLog.rows[0].id, dbUser.id).catch(() => {
      auditLogged = false;
    });

    return NextResponse.json({
      sent: true,
      auditLogged,
      warning: auditLogged ? undefined : "Email was sent, but audit logging failed. Review the audit log configuration."
    });
  } catch (error) {
    return handleApiError(error);
  }
}
