import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { detectDocxPlaceholders } from "@/lib/docx-placeholders";
import { handleApiError } from "@/lib/http";
import { saveBuffer } from "@/lib/storage";

export const runtime = "nodejs";

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
    await requireAuth(request, ["Admin", "Admissions Supervisor"]);
    const formData = await request.formData();
    const file = formData.get("file");
    const name = String(formData.get("name") || "");
    const templateType = String(formData.get("templateType") || "");

    if (!(file instanceof File) || !name || !templateType) {
      return NextResponse.json({ error: "file, name, and templateType are required." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: "Only DOCX template uploads are allowed." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const placeholders = detectDocxPlaceholders(buffer);
    const storageKey = await saveBuffer("templates", file.name, buffer);

    const result = await query<{ id: string }>(
      `INSERT INTO templates (name, template_type, original_file_name, storage_key, placeholders, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (template_type) DO UPDATE SET
         name = EXCLUDED.name,
         original_file_name = EXCLUDED.original_file_name,
         storage_key = EXCLUDED.storage_key,
         placeholders = EXCLUDED.placeholders,
         is_active = true,
         uploaded_at = now()
       RETURNING id`,
      [name, templateType, file.name, storageKey, placeholders]
    );

    await audit("template.upserted", "templates", {
      templateType,
      originalFileName: file.name,
      placeholderCount: placeholders.length
    }, result.rows[0].id);

    return NextResponse.json({ id: result.rows[0].id, placeholders });
  } catch (error) {
    return handleApiError(error);
  }
}
