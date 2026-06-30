import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendGraphMail } from "@/lib/graph-mail";
import { handleApiError } from "@/lib/http";
import { readStorageBuffer } from "@/lib/storage";

export const runtime = "nodejs";

const schema = z.object({
  generatedLetterId: z.string().uuid(),
  subject: z.string().min(1),
  body: z.string().min(1),
  resendReason: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor", "Counselor"]);
    if (!user.accessToken) {
      throw new HttpError(401, "Microsoft Graph email sending requires the authenticated user's bearer token.");
    }

    const body = schema.parse(await request.json());
    const letterResult = await query<{
      applicant_id: string;
      pdf_storage_key: string | null;
      student_id: string;
      email: string;
      first_name: string;
      last_name: string;
    }>(
      `SELECT gl.applicant_id, gl.pdf_storage_key, a.student_id, a.email, a.first_name, a.last_name
         FROM generated_letters gl
         JOIN applicants a ON a.id = gl.applicant_id
        WHERE gl.id = $1`,
      [body.generatedLetterId]
    );
    const letter = letterResult.rows[0];
    if (!letter) return NextResponse.json({ error: "Generated letter not found." }, { status: 404 });
    if (!letter.pdf_storage_key) return NextResponse.json({ error: "Generate the PDF before sending email." }, { status: 400 });

    const sentResult = await query<{ id: string }>(
      `SELECT id FROM email_logs
        WHERE generated_letter_id = $1 AND status = 'sent'
        LIMIT 1`,
      [body.generatedLetterId]
    );
    if (sentResult.rows.length && !body.resendReason) {
      return NextResponse.json({ error: "This letter was already sent. Provide a resend reason to send again." }, { status: 409 });
    }

    const pdf = await readStorageBuffer(letter.pdf_storage_key);
    await sendGraphMail({
      accessToken: user.accessToken,
      recipient: letter.email,
      subject: body.subject,
      body: body.body,
      attachmentName: `${letter.student_id}-admissions-letter.pdf`,
      attachmentContent: pdf
    });

    await query(
      `INSERT INTO email_logs (applicant_id, generated_letter_id, recipient, subject, body, status, sent_at, resend_reason)
       VALUES ($1, $2, $3, $4, $5, 'sent', now(), $6)`,
      [letter.applicant_id, body.generatedLetterId, letter.email, body.subject, body.body, body.resendReason ?? null]
    );
    await query("UPDATE applicants SET email_status = 'Sent', sent_date = now() WHERE id = $1", [letter.applicant_id]);

    return NextResponse.json({ sent: true });
  } catch (error) {
    return handleApiError(error);
  }
}
