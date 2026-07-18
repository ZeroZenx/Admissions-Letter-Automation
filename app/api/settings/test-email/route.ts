import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/http";
import { getStoredSmtpConfiguration } from "@/lib/settings";
import { sendSmtpTestMail, smtpDiagnosticMessage } from "@/lib/smtp-mail";
import { ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor"]);
    const dbUser = await ensureDbUser(user);
    const configuration = await getStoredSmtpConfiguration();
    try {
      await sendSmtpTestMail(configuration);
    } catch (error) {
      console.error("SMTP test email failed", error);
      return NextResponse.json({ error: smtpDiagnosticMessage(error) }, { status: 502 });
    }
    await audit("settings.smtp_test_sent", "email_sender_settings", { senderEmail: configuration.senderEmail, host: configuration.host }, undefined, dbUser.id);
    return NextResponse.json({ sent: true, recipient: configuration.senderEmail });
  } catch (error) {
    return handleApiError(error);
  }
}
