import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { getAppSettings, upsertAppSettings } from "@/lib/settings";
import { handleApiError } from "@/lib/http";
import { ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const schema = z.object({
  email: z.object({
    defaultSubject: z.string().trim().min(1).max(160),
    defaultBody: z.string().trim().min(1).max(12000),
    stalePendingMinutes: z.coerce.number().int().min(5).max(1440),
    provider: z.enum(["graph", "smtp"]),
    senderEmail: z.string().trim().email().max(320).or(z.literal("")),
    smtpHost: z.string().trim().max(253).regex(/^[A-Za-z0-9.-]*$/, "SMTP host contains invalid characters."),
    smtpPort: z.coerce.number().int().min(1).max(65535),
    smtpSecure: z.boolean(),
    smtpUsername: z.string().trim().max(320).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "SMTP username contains invalid control characters."),
    passwordConfigured: z.boolean(),
    password: z.string().min(1).max(1000).optional(),
    clearPassword: z.boolean().optional()
  }),
  pdf: z.object({
    converter: z.enum(["libreoffice"])
  })
});

export async function GET(request: Request) {
  try {
    await requireAuth(request, ["Admin", "Admissions Supervisor", "Counselor"]);
    const settings = await getAppSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor"]);
    const dbUser = await ensureDbUser(user);
    const settings = schema.parse(await request.json());
    if (settings.email.provider === "smtp" && (!settings.email.senderEmail || !settings.email.smtpHost || !settings.email.smtpUsername)) {
      return NextResponse.json({ error: "Sender email, SMTP host, and SMTP username are required for shared SMTP." }, { status: 400 });
    }
    const current = await getAppSettings();
    if (settings.email.provider === "smtp" && !settings.email.password && (!current.email.passwordConfigured || settings.email.clearPassword)) {
      return NextResponse.json({ error: "Enter the shared sender password before selecting SMTP." }, { status: 400 });
    }
    await upsertAppSettings(settings, dbUser.id);
    await audit("settings.updated", "app_settings", {
      keys: [
        "email.defaultSubject",
        "email.defaultBody",
        "email.stalePendingMinutes",
        "email.provider",
        "email.senderEmail",
        "email.smtpHost",
        "email.smtpPort",
        "email.smtpSecure",
        "email.smtpUsername",
        "pdf.converter"
      ],
      provider: settings.email.provider,
      senderPasswordChanged: Boolean(settings.email.password || settings.email.clearPassword)
    }, undefined, dbUser.id);
    return NextResponse.json({ settings: await getAppSettings() });
  } catch (error) {
    return handleApiError(error);
  }
}
