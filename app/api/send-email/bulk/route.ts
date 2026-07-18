import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { HttpError, requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/http";
import { query } from "@/lib/db";
import { uploadLimits } from "@/lib/request-limits";
import { getAppSettings } from "@/lib/settings";
import { counselorApplicantWhereClause, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const schema = z.object({
  generatedLetterIds: z.array(z.string().uuid()).min(1).max(uploadLimits.bulkEmailGeneratedLetterIds),
  subject: z.string().trim().min(1).max(160).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Email subject cannot contain control characters."),
  body: z.string().trim().min(1).max(12000),
  resendReason: z.string().trim().max(1000).optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor", "Counselor"]);
    const dbUser = await ensureDbUser(user);
    const input = schema.parse(await request.json());
    if (new Set(input.generatedLetterIds).size !== input.generatedLetterIds.length) {
      return NextResponse.json({ error: "Each generated letter can appear only once in an email batch." }, { status: 400 });
    }

    const ownership = counselorApplicantWhereClause(user, dbUser.id, 2);
    const batchLetters = await query<{ id: string; template_type: string }>(
      `SELECT gl.id, a.template_type
         FROM generated_letters gl
         JOIN applicants a ON a.id = gl.applicant_id
        WHERE gl.id = ANY($1::uuid[])
          AND EXISTS (SELECT 1 FROM imports i WHERE i.id = a.import_id AND i.archived_at IS NULL)
          ${ownership.clause ? `AND ${ownership.clause}` : ""}`,
      [input.generatedLetterIds, ...ownership.params]
    );
    if (batchLetters.rows.length !== input.generatedLetterIds.length) {
      return NextResponse.json({ error: "One or more generated letters were not found or are not available to this user." }, { status: 404 });
    }
    const templateTypes = [...new Set(batchLetters.rows.map((letter) => letter.template_type))];
    if (templateTypes.length !== 1) {
      return NextResponse.json({ error: "Select generated letters from one template type per email batch." }, { status: 400 });
    }

    const settings = await getAppSettings();
    const graphAccessToken = request.headers.get("x-graph-access-token") ?? user.accessToken;
    if (settings.email.provider === "graph" && !graphAccessToken) {
      throw new HttpError(401, "Microsoft Graph email sending requires a delegated Graph bearer token.");
    }

    const origin = new URL(request.url).origin;
    const authorization = request.headers.get("authorization");
    const devRole = request.headers.get("x-dev-role");
    const results: Array<{ generatedLetterId: string; ok: boolean; sent: boolean; error?: string; warning?: string }> = [];

    for (const generatedLetterId of input.generatedLetterIds) {
      try {
        const response = await fetch(`${origin}/api/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authorization ? { Authorization: authorization } : {}),
            ...(devRole ? { "x-dev-role": devRole } : {}),
            ...(graphAccessToken ? { "x-graph-access-token": graphAccessToken } : {})
          },
          body: JSON.stringify({
            generatedLetterId,
            subject: input.subject,
            body: input.body,
            resendReason: input.resendReason
          })
        });
        const result = await readResponse(response);
        results.push({
          generatedLetterId,
          ok: response.ok && result.sent === true,
          sent: response.ok && result.sent === true,
          error: typeof result.error === "string" ? result.error : undefined,
          warning: typeof result.warning === "string" ? result.warning : undefined
        });
      } catch (error) {
        results.push({
          generatedLetterId,
          ok: false,
          sent: false,
          error: boundedMessage(error instanceof Error ? error.message : "Email could not be sent.")
        });
      }
    }

    const sentCount = results.filter((result) => result.sent).length;
    const failedCount = results.length - sentCount;
    const warningCount = results.filter((result) => result.sent && result.warning).length;
    await audit("email.batch_completed", "email_logs", {
      requestedCount: input.generatedLetterIds.length,
      templateType: templateTypes[0],
      sentCount,
      failedCount,
      warningCount
    }, undefined, dbUser.id).catch(() => undefined);

    return NextResponse.json({ results, requestedCount: results.length, sentCount, failedCount, warningCount });
  } catch (error) {
    return handleApiError(error);
  }
}

async function readResponse(response: Response) {
  try {
    const value = await response.json();
    if (typeof value !== "object" || value === null) return {} as Record<string, unknown>;
    const record = value as Record<string, unknown>;
    return {
      ...record,
      error: typeof record.error === "string" ? boundedMessage(record.error) : undefined,
      warning: typeof record.warning === "string" ? boundedMessage(record.warning) : undefined
    };
  } catch {
    return { error: boundedMessage(`${response.status} ${response.statusText || "Email send failed"}`) };
  }
}

function boundedMessage(message: string) {
  const trimmed = message.trim() || "Email could not be sent.";
  return trimmed.length <= 1000 ? trimmed : `${trimmed.slice(0, 997)}...`;
}
