import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/http";
import { getStoredSmtpConfiguration } from "@/lib/settings";
import { verifySmtp } from "@/lib/smtp-mail";
import { ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor"]);
    const dbUser = await ensureDbUser(user);
    const configuration = await getStoredSmtpConfiguration();
    await verifySmtp(configuration);
    await audit("settings.smtp_verified", "email_sender_settings", { senderEmail: configuration.senderEmail, host: configuration.host }, undefined, dbUser.id);
    return NextResponse.json({ verified: true });
  } catch (error) {
    return handleApiError(error);
  }
}
