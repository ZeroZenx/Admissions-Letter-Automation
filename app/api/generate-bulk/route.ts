import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { getAuthEnv } from "@/lib/env";
import { handleApiError } from "@/lib/http";
import { ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const schema = z.object({
  applicantIds: z.array(z.string().uuid()).min(1),
  sendEmail: z.boolean().default(false),
  subject: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().min(1).max(12000).optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor", "Counselor"]);
    const dbUser = await ensureDbUser(user);
    const body = schema.parse(await request.json());
    const authEnv = getAuthEnv();
    const origin = new URL(request.url).origin;
    const authorization = request.headers.get("authorization");
    const devRole = request.headers.get("x-dev-role");
    const graphAccessToken = request.headers.get("x-graph-access-token");
    const results = [];

    if (body.sendEmail && (!body.subject || !body.body)) {
      return NextResponse.json({ error: "subject and body are required when sendEmail is true." }, { status: 400 });
    }
    if (body.sendEmail && authEnv.AUTH_MODE !== "development" && !graphAccessToken) {
      return NextResponse.json({ error: "Microsoft Graph token is required when sendEmail is true." }, { status: 401 });
    }

    for (const applicantId of body.applicantIds) {
      const response = await fetch(`${origin}/api/generate-letter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { Authorization: authorization } : {}),
          ...(devRole ? { "x-dev-role": devRole } : {})
        },
        body: JSON.stringify({ applicantId, convertPdf: true })
      });
      const generationResult = await readResponseJson(response);
      let emailResult: { ok: boolean; result: unknown } | null = null;

      if (response.ok && body.sendEmail) {
        const emailResponse = await fetch(`${origin}/api/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authorization ? { Authorization: authorization } : {}),
            ...(devRole ? { "x-dev-role": devRole } : {}),
            ...(graphAccessToken ? { "x-graph-access-token": graphAccessToken } : {})
          },
          body: JSON.stringify({
            generatedLetterId: generationResult.generatedLetterId,
            subject: body.subject,
            body: body.body
          })
        });
        emailResult = { ok: emailResponse.ok, result: await readResponseJson(emailResponse) };
      }

      if (!response.ok || (emailResult && !emailResult.ok)) {
        const failure = emailResult && !emailResult.ok ? emailResult.result : generationResult;
        const errorMessage = readError(failure);
        await query("UPDATE applicants SET error_message = $1 WHERE id = $2", [errorMessage, applicantId]);
      }

      results.push({
        applicantId,
        ok: response.ok && (!emailResult || emailResult.ok),
        generated: response.ok,
        emailed: emailResult?.ok ?? false,
        result: generationResult,
        emailResult
      });
    }

    const generatedCount = results.filter((result) => result.generated).length;
    const emailedCount = results.filter((result) => result.emailed).length;
    const failedCount = results.filter((result) => !result.ok).length;
    await audit("batch.generated", "generated_letters", {
      requestedCount: body.applicantIds.length,
      generatedCount,
      emailedCount,
      failedCount,
      sendEmail: body.sendEmail
    }, undefined, dbUser.id);

    return NextResponse.json({ results });
  } catch (error) {
    return handleApiError(error);
  }
}

function readError(value: unknown) {
  if (value && typeof value === "object" && "error" in value && typeof value.error === "string") return value.error;
  return "Batch automation failed.";
}

async function readResponseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return { error: `${response.status} ${response.statusText || "Non-JSON response"}` };
  }
}
