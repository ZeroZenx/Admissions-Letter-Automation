import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { deleteStorageFile } from "@/lib/storage";
import { ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const patchSchema = z.object({ archived: z.boolean() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor"]);
    const dbUser = await ensureDbUser(user);
    const { id } = await context.params;
    const importId = z.string().uuid().parse(id);
    const { archived } = patchSchema.parse(await request.json());
    const result = await query<{ uploaded_file_name: string }>(
      `UPDATE imports
          SET archived_at = CASE WHEN $2 THEN now() ELSE null END,
              archived_by = CASE WHEN $2 THEN $3::uuid ELSE null END
        WHERE id = $1
        RETURNING uploaded_file_name`,
      [importId, archived, dbUser.id]
    );
    if (!result.rowCount) return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    await audit(archived ? "import.archived" : "import.restored", "imports", { uploadedFileName: result.rows[0].uploaded_file_name }, importId, dbUser.id);
    return NextResponse.json({ archived });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request, ["Admin"]);
    const dbUser = await ensureDbUser(user);
    const { id } = await context.params;
    const importId = z.string().uuid().parse(id);
    const result = await query<{
      uploaded_file_name: string;
      storage_key: string | null;
      generated_keys: string[];
    }>(
      `SELECT i.uploaded_file_name, i.storage_key,
              COALESCE(array_agg(keys.key) FILTER (WHERE keys.key IS NOT NULL), ARRAY[]::text[]) AS generated_keys
         FROM imports i
         LEFT JOIN applicants a ON a.import_id = i.id
         LEFT JOIN generated_letters gl ON gl.applicant_id = a.id
         LEFT JOIN LATERAL (VALUES (gl.docx_storage_key), (gl.pdf_storage_key)) AS keys(key) ON true
        WHERE i.id = $1 AND i.archived_at IS NOT NULL
        GROUP BY i.id`,
      [importId]
    );
    const record = result.rows[0];
    if (!record) return NextResponse.json({ error: "Archive the import batch before clearing it." }, { status: 409 });

    await query("DELETE FROM imports WHERE id = $1 AND archived_at IS NOT NULL", [importId]);
    const keys = [...new Set([record.storage_key, ...record.generated_keys].filter((key): key is string => Boolean(key)))];
    const cleanup = await Promise.allSettled(keys.map((key) => deleteStorageFile(key)));
    const cleanupFailures = cleanup.filter((item) => item.status === "rejected").length;
    await audit("import.cleared", "imports", { uploadedFileName: record.uploaded_file_name, fileCount: keys.length, cleanupFailures }, undefined, dbUser.id);
    return NextResponse.json({ cleared: true, cleanupFailures });
  } catch (error) {
    return handleApiError(error);
  }
}
