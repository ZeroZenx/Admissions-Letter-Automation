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
    defaultBody: z.string().trim().min(1).max(12000)
  }),
  pdf: z.object({
    converter: z.enum(["libreoffice"])
  })
});

export async function GET(request: Request) {
  try {
    await requireAuth(request);
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
    await upsertAppSettings(settings, dbUser.id);
    await audit("settings.updated", "app_settings", {
      keys: ["email.defaultSubject", "email.defaultBody", "pdf.converter"]
    }, undefined, dbUser.id);
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
