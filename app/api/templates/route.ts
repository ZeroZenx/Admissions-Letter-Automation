import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { mappableLetterFields } from "@/lib/banner-fields";
import { query } from "@/lib/db";
import { detectDocxPlaceholders, normalizePlaceholder } from "@/lib/docx-placeholders";
import { handleApiError } from "@/lib/http";
import { uploadLimits, validateFileSize } from "@/lib/request-limits";
import { saveBuffer } from "@/lib/storage";
import { parseTemplateType } from "@/lib/template-types";
import { ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const statusSchema = z.object({
  templateId: z.string().uuid(),
  isActive: z.boolean()
});
const autoMappableFields = new Map(mappableLetterFields.map((field) => [autoMapKey(field), field]));

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const result = await query(
      `SELECT t.id, t.name, t.template_type, t.original_file_name, t.placeholders, t.is_active, t.uploaded_at,
              COALESCE(json_agg(json_build_object('placeholder', fm.placeholder, 'bannerField', fm.banner_field, 'fallbackValue', fm.fallback_value))
                FILTER (WHERE fm.id IS NOT NULL), '[]') AS mappings
         FROM templates t
         LEFT JOIN field_mappings fm ON fm.template_id = t.id
         GROUP BY t.id
         ORDER BY t.template_type`
    );
    return NextResponse.json({ templates: result.rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor"]);
    const dbUser = await ensureDbUser(user);
    const formData = await request.formData();
    const file = formData.get("file");
    const name = String(formData.get("name") || "").trim();
    const templateTypeInput = String(formData.get("templateType") || "");

    if (!(file instanceof File) || !name || !templateTypeInput.trim()) {
      return NextResponse.json({ error: "file, name, and templateType are required." }, { status: 400 });
    }
    const templateType = parseTemplateType(templateTypeInput);
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: "Only DOCX template uploads are allowed." }, { status: 400 });
    }
    const sizeError = validateFileSize(file, uploadLimits.docxBytes, "DOCX template");
    if (sizeError) return sizeError;

    const buffer = Buffer.from(await file.arrayBuffer());
    const placeholders = detectDocxPlaceholders(buffer);
    const storageKey = await saveBuffer("templates", file.name, buffer);

    const result = await query<{ id: string }>(
      `INSERT INTO templates (name, template_type, original_file_name, storage_key, placeholders, is_active, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       ON CONFLICT (template_type) DO UPDATE SET
         name = EXCLUDED.name,
         original_file_name = EXCLUDED.original_file_name,
         storage_key = EXCLUDED.storage_key,
         placeholders = EXCLUDED.placeholders,
         is_active = true,
         uploaded_by = EXCLUDED.uploaded_by,
         uploaded_at = now()
       RETURNING id`,
      [name, templateType, file.name, storageKey, placeholders, dbUser.id]
    );
    const autoMappings = placeholders
      .map((placeholder) => ({
        placeholder: placeholder.name,
        bannerField: autoMappableFields.get(autoMapKey(placeholder.name))
      }))
      .filter((mapping): mapping is { placeholder: string; bannerField: (typeof mappableLetterFields)[number] } => Boolean(mapping.bannerField));
    for (const mapping of autoMappings) {
      await query(
        `INSERT INTO field_mappings (template_id, placeholder, banner_field)
         VALUES ($1, $2, $3)
         ON CONFLICT (template_id, placeholder) DO UPDATE SET banner_field = EXCLUDED.banner_field`,
        [result.rows[0].id, mapping.placeholder, mapping.bannerField]
      );
    }

    await audit("template.upserted", "templates", {
      templateType,
      originalFileName: file.name,
      placeholderCount: placeholders.length,
      autoMappedCount: autoMappings.length
    }, result.rows[0].id, dbUser.id);

    return NextResponse.json({ id: result.rows[0].id, placeholders });
  } catch (error) {
    return handleApiError(error);
  }
}

function autoMapKey(value: string) {
  return normalizePlaceholder(value).replace(/_/g, "").toLowerCase();
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor"]);
    const dbUser = await ensureDbUser(user);
    const body = statusSchema.parse(await request.json());

    const result = await query<{ id: string; template_type: string; is_active: boolean }>(
      `UPDATE templates
          SET is_active = $1
        WHERE id = $2
        RETURNING id, template_type, is_active`,
      [body.isActive, body.templateId]
    );

    const template = result.rows[0];
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    await audit("template.status_updated", "templates", {
      templateType: template.template_type,
      isActive: template.is_active
    }, template.id, dbUser.id);

    return NextResponse.json({ template });
  } catch (error) {
    return handleApiError(error);
  }
}
