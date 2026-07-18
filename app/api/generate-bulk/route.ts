import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { uploadLimits } from "@/lib/request-limits";
import { counselorApplicantWhereClause, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const schema = z.object({
  applicantIds: z.array(z.string().uuid()).min(1).max(uploadLimits.bulkApplicantIds)
}).strict();
const BULK_ERROR_MESSAGE_LIMIT = 1000;

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor", "Counselor"]);
    const dbUser = await ensureDbUser(user);
    const body = schema.parse(await request.json());
    const origin = new URL(request.url).origin;
    const authorization = request.headers.get("authorization");
    const devRole = request.headers.get("x-dev-role");
    const results = [];

    if (hasDuplicateApplicantIds(body.applicantIds)) {
      return NextResponse.json({ error: "Bulk automation applicantIds must be unique." }, { status: 400 });
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

      if (!generated) {
        const errorMessage = readError(generationResult);
        await query("UPDATE applicants SET error_message = $1, processed_by_flow = false WHERE id = $2", [
          errorMessage,
          applicantId
        ]);
      }

      results.push({
        applicantId,
        ok: generated,
        generated,
        result: generationResult
      });
    }

    const generatedCount = results.filter((result) => result.generated).length;
    const failedCount = results.filter((result) => !result.ok).length;
    await audit("batch.generated", "generated_letters", {
      requestedCount: body.applicantIds.length,
      generatedCount,
      failedCount
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
        AND EXISTS (SELECT 1 FROM imports i WHERE i.id = applicants.import_id AND i.archived_at IS NULL)
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
