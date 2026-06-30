import { NextResponse } from "next/server";
import archiver from "archiver";
import { PassThrough } from "node:stream";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { storagePath } from "@/lib/storage";

export const runtime = "nodejs";

const schema = z.object({
  generatedLetterIds: z.array(z.string().uuid()).min(1)
});

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    const body = schema.parse(await request.json());
    const result = await query<{ id: string; pdf_storage_key: string | null; docx_storage_key: string }>(
      `SELECT id, pdf_storage_key, docx_storage_key
         FROM generated_letters
         WHERE id = ANY($1::uuid[])`,
      [body.generatedLetterIds]
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();
    archive.pipe(stream);

    for (const letter of result.rows) {
      const key = letter.pdf_storage_key ?? letter.docx_storage_key;
      archive.file(storagePath(key), { name: `${letter.id}.${letter.pdf_storage_key ? "pdf" : "docx"}` });
    }
    void archive.finalize();

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="admissions-letters.zip"'
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
