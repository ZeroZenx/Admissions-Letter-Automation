import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { handleApiError } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({
  templateId: z.string().uuid(),
  mappings: z.array(
    z.object({
      placeholder: z.string().min(1),
      bannerField: z.string().min(1),
      fallbackValue: z.string().optional()
    })
  )
});

export async function POST(request: Request) {
  try {
    await requireAuth(request, ["Admin", "Admissions Supervisor"]);
    const body = schema.parse(await request.json());
    await withTransaction(async (client) => {
      await client.query("DELETE FROM field_mappings WHERE template_id = $1", [body.templateId]);
      for (const mapping of body.mappings) {
        await client.query(
          `INSERT INTO field_mappings (template_id, placeholder, banner_field, fallback_value)
           VALUES ($1, $2, $3, $4)`,
          [body.templateId, mapping.placeholder, mapping.bannerField, mapping.fallbackValue ?? null]
        );
      }
    });

    await audit("field_mappings.updated", "templates", {
      templateId: body.templateId,
      mappingCount: body.mappings.length
    }, body.templateId);

    const result = await query("SELECT * FROM field_mappings WHERE template_id = $1 ORDER BY placeholder", [body.templateId]);
    return NextResponse.json({ mappings: result.rows });
  } catch (error) {
    return handleApiError(error);
  }
}
