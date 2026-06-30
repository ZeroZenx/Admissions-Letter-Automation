import { NextResponse } from "next/server";
import archiver from "archiver";
import { PassThrough } from "node:stream";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { storagePath } from "@/lib/storage";
import { enforceApplicantOwnership, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const schema = z.object({
  generatedLetterIds: z.array(z.string().uuid()).min(1)
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const dbUser = await ensureDbUser(user);
    const body = schema.parse(await request.json());
    const result = await query<{
      id: string;
      pdf_storage_key: string | null;
      docx_storage_key: string;
      counselor_user_id: string | null;
      student_id: string;
    }>(
      `SELECT gl.id, gl.pdf_storage_key, gl.docx_storage_key, a.counselor_user_id, a.student_id
         FROM generated_letters gl
         JOIN applicants a ON a.id = gl.applicant_id
        WHERE gl.id = ANY($1::uuid[])`,
      [body.generatedLetterIds]
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();
    archive.pipe(stream);

    for (const letter of result.rows) {
      enforceApplicantOwnership(user, dbUser.id, letter);
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
