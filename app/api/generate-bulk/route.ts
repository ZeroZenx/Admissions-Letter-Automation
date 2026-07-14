import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { getAuthEnv } from "@/lib/env";
import { handleApiError } from "@/lib/http";
import { uploadLimits } from "@/lib/request-limits";
import { counselorApplicantWhereClause, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const schema = z.object({
  applicantIds: z.array(z.string().uuid()).min(1).max(uploadLimits.bulkApplicantIds),
  sendEmail: z.boolean().default(false),
  subject: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().min(1).max(12000).optional()
});
const BULK_ERROR_MESSAGE_LIMIT = 1000;

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
    if (hasDuplicateApplicantIds(body.applicantIds)) {
      return NextResponse.json({ error: "Bulk automation applicantIds must be unique." }, { status: 400 });
    }
    if (body.sendEmail && authEnv.AUTH_MODE !== "development" && !graphAccessToken) {
      return NextResponse.json({ error: "Microsoft Graph token is required when sendEmail is true." }, { status: 401 });
    }
    const preflight = await buildBulkAutomationPreflight(body.applicantIds, user, dbUser.id);
    if (preflight.missingOrUnavailableCount > 0) {
      return NextResponse.json({ error: "One or more selected applicants were not found or are not available to this user." }, { status: 404 });
    }
    if (preflight.invalidApplicantCount > 0) {
      return NextResponse.json({ error: "Selected applicants include source-truth rows with validation errors. Correct those rows before generating letters." }, { status: 400 });
    }
    if (preflight.blockedTemplates.length > 0) {
      return NextResponse.json({
        error: `Automation preflight blocked ${preflight.blockedTemplates.map(formatBlockedTemplate).join("; ")}.`,
        preflight: preflight.blockedTemplates
      }, { status: 400 });
    }

    for (const applicantId of body.applicantIds) {
      let generated = false;
      let generationResult: unknown = null;
      let emailResult: { ok: boolean; result: unknown } | null = null;

      try {
        const response = await fetch(`${origin}/api/generate-letter`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authorization ? { Authorization: authorization } : {}),
            ...(devRole ? { "x-dev-role": devRole } : {})
          },
          body: JSON.stringify({ applicantId, convertPdf: true })
        });
        generated = response.ok;
        generationResult = await readResponseJson(response);
      } catch (error) {
        generationResult = { error: clientErrorMessage(error) };
      }

      if (generated && body.sendEmail) {
        try {
          const emailResponse = await fetch(`${origin}/api/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(authorization ? { Authorization: authorization } : {}),
              ...(devRole ? { "x-dev-role": devRole } : {}),
              ...(graphAccessToken ? { "x-graph-access-token": graphAccessToken } : {})
            },
            body: JSON.stringify({
              generatedLetterId: readGeneratedLetterId(generationResult),
              subject: body.subject,
              body: body.body
            })
          });
          emailResult = { ok: emailResponse.ok, result: await readResponseJson(emailResponse) };
        } catch (error) {
          emailResult = { ok: false, result: { error: clientErrorMessage(error) } };
        }
      }

      if (!generated || (emailResult && !emailResult.ok)) {
        const failure = emailResult && !emailResult.ok ? emailResult.result : generationResult;
        const errorMessage = readError(failure);
        if (!generated) {
          await query("UPDATE applicants SET error_message = $1, processed_by_flow = false WHERE id = $2", [
            errorMessage,
            applicantId
          ]);
        } else {
          await query("UPDATE applicants SET email_status = 'Failed', error_message = $1 WHERE id = $2", [
            errorMessage,
            applicantId
          ]);
        }
      }

      results.push({
        applicantId,
        ok: generated && (!emailResult || emailResult.ok),
        generated,
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
  if (value && typeof value === "object" && "error" in value && typeof value.error === "string") {
    return boundedErrorMessage(value.error);
  }
  return "Batch automation failed.";
}

function readGeneratedLetterId(value: unknown) {
  if (value && typeof value === "object" && "generatedLetterId" in value && typeof value.generatedLetterId === "string") {
    return value.generatedLetterId;
  }
  return "";
}

function clientErrorMessage(error: unknown) {
  return boundedErrorMessage(error instanceof Error ? error.message : "Batch automation failed.");
}

async function readResponseJson(response: Response) {
  try {
    return normalizeInternalResponse(await response.json());
  } catch {
    return { error: boundedErrorMessage(`${response.status} ${response.statusText || "Non-JSON response"}`) };
  }
}

function normalizeInternalResponse(value: unknown) {
  if (value && typeof value === "object" && "error" in value && typeof value.error === "string") {
    return { ...value, error: boundedErrorMessage(value.error) };
  }
  return value;
}

function boundedErrorMessage(message: string) {
  const trimmed = message.trim() || "Batch automation failed.";
  if (trimmed.length <= BULK_ERROR_MESSAGE_LIMIT) return trimmed;
  return `${trimmed.slice(0, BULK_ERROR_MESSAGE_LIMIT - 3)}...`;
}

async function buildBulkAutomationPreflight(applicantIds: string[], user: Awaited<ReturnType<typeof requireAuth>>, dbUserId: string) {
  const ownership = counselorApplicantWhereClause(user, dbUserId, 2);
  const applicants = await query<{ template_type: string; validation_errors: unknown }>(
    `SELECT template_type, validation_errors
       FROM applicants
      WHERE id = ANY($1::uuid[])
        ${ownership.clause ? `AND ${ownership.clause}` : ""}`,
    [applicantIds, ...ownership.params]
  );
  const invalidApplicantCount = applicants.rows.filter((applicant) => hasValidationErrors(applicant.validation_errors)).length;
  const requiredTemplateTypes = [...new Set(applicants.rows.map((applicant) => applicant.template_type))];
  if (requiredTemplateTypes.length === 0) {
    return {
      missingOrUnavailableCount: applicantIds.length,
      invalidApplicantCount,
      blockedTemplates: [] as BulkTemplatePreflight[]
    };
  }

  const templates = await query<{
    template_type: string;
    is_active: boolean;
    placeholders: Array<{ name?: string }>;
    mapped_placeholders: string[];
  }>(
    `SELECT t.template_type, t.is_active, t.placeholders,
            COALESCE(array_agg(fm.placeholder) FILTER (WHERE fm.id IS NOT NULL), ARRAY[]::text[]) AS mapped_placeholders
       FROM templates t
       LEFT JOIN field_mappings fm ON fm.template_id = t.id
      WHERE t.template_type = ANY($1::text[])
      GROUP BY t.id`,
    [requiredTemplateTypes]
  );
  const templateMap = new Map(templates.rows.map((template) => [template.template_type, template]));
  const blockedTemplates = requiredTemplateTypes
    .map((templateType) => {
      const template = templateMap.get(templateType);
      const placeholderNames = Array.isArray(template?.placeholders)
        ? template.placeholders.map((placeholder) => placeholder.name).filter((name): name is string => Boolean(name))
        : [];
      const mapped = new Set(template?.mapped_placeholders ?? []);
      const missingPlaceholderNames = placeholderNames.filter((name) => !mapped.has(name));
      const status = !template ? "missing_template" : !template.is_active ? "inactive_template" : missingPlaceholderNames.length ? "missing_mappings" : "ready";
      return {
        templateType,
        status,
        ready: status === "ready",
        missingPlaceholderNames
      };
    })
    .filter((template) => !template.ready);

  return {
    missingOrUnavailableCount: applicantIds.length - applicants.rows.length,
    invalidApplicantCount,
    blockedTemplates
  };
}

type BulkTemplatePreflight = {
  templateType: string;
  status: string;
  ready: boolean;
  missingPlaceholderNames: string[];
};

function formatBlockedTemplate(template: BulkTemplatePreflight) {
  if (template.status === "missing_mappings") {
    return `${template.templateType}: missing mappings for ${template.missingPlaceholderNames.join(", ")}`;
  }
  return `${template.templateType}: ${template.status}`;
}

function hasValidationErrors(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

function hasDuplicateApplicantIds(applicantIds: string[]) {
  return new Set(applicantIds).size !== applicantIds.length;
}
