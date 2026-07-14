import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { HttpError, requireAuth } from "@/lib/auth";
import { mappableLetterFields } from "@/lib/banner-fields";
import { query, withTransaction } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const maxFallbackValueLength = 2000;

const schema = z.object({
  templateId: z.string().uuid(),
  mappings: z.array(
    z.object({
      placeholder: z.string().min(1),
      bannerField: z.enum(mappableLetterFields),
      fallbackValue: z.string().trim().max(maxFallbackValueLength).optional()
    })
  )
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor"]);
    const dbUser = await ensureDbUser(user);
    const body = schema.parse(await request.json());
    const templateResult = await query<{ placeholders: unknown }>("SELECT placeholders FROM templates WHERE id = $1", [body.templateId]);
    const template = templateResult.rows[0];
    if (!template) throw new HttpError(404, "Template not found.");
    const duplicatePlaceholders = duplicateMappingPlaceholders(body.mappings);
    if (duplicatePlaceholders.length) {
      throw new HttpError(400, `Mappings include duplicate placeholders: ${duplicatePlaceholders.join(", ")}.`);
    }

    const allowedPlaceholders = templatePlaceholderNames(template.placeholders);
    const unknownPlaceholders = body.mappings
      .map((mapping) => mapping.placeholder)
      .filter((placeholder) => !allowedPlaceholders.has(placeholder));
    if (unknownPlaceholders.length) {
      throw new HttpError(400, `Mappings include placeholders not detected in the template: ${unknownPlaceholders.join(", ")}.`);
    }
    const mappedPlaceholders = new Set(body.mappings.map((mapping) => mapping.placeholder));
    const missingPlaceholders = [...allowedPlaceholders].filter((placeholder) => !mappedPlaceholders.has(placeholder));
    if (missingPlaceholders.length) {
      throw new HttpError(400, `Mappings are missing detected placeholders: ${missingPlaceholders.join(", ")}.`);
    }

    await withTransaction(async (client) => {
      await client.query("DELETE FROM field_mappings WHERE template_id = $1", [body.templateId]);
      for (const mapping of body.mappings) {
        await client.query(
          `INSERT INTO field_mappings (template_id, placeholder, banner_field, fallback_value)
           VALUES ($1, $2, $3, $4)`,
          [body.templateId, mapping.placeholder, mapping.bannerField, mapping.fallbackValue || null]
        );
      }
    });

    await audit("field_mappings.updated", "templates", {
      templateId: body.templateId,
      mappingCount: body.mappings.length
    }, body.templateId, dbUser.id);

    const result = await query(
      `SELECT placeholder, banner_field, fallback_value
         FROM field_mappings
        WHERE template_id = $1
        ORDER BY placeholder`,
      [body.templateId]
    );
    return NextResponse.json({ mappings: result.rows });
  } catch (error) {
    return handleApiError(error);
  }
}

function templatePlaceholderNames(placeholders: unknown) {
  return new Set(
    Array.isArray(placeholders)
      ? placeholders
          .map((placeholder) => (placeholder && typeof placeholder === "object" && "name" in placeholder ? placeholder.name : undefined))
          .filter((name): name is string => typeof name === "string" && name.length > 0)
      : []
  );
}

function duplicateMappingPlaceholders(mappings: Array<{ placeholder: string }>) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const mapping of mappings) {
    if (seen.has(mapping.placeholder)) duplicates.add(mapping.placeholder);
    seen.add(mapping.placeholder);
  }
  return [...duplicates];
}
