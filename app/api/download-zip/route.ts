import { NextResponse } from "next/server";
import archiver from "archiver";
import { PassThrough } from "node:stream";
import { z } from "zod";
import { audit } from "@/lib/audit";
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
    const requestedIds = new Set(body.generatedLetterIds);
    for (const letter of result.rows) requestedIds.delete(letter.id);
    if (requestedIds.size) {
      return NextResponse.json({ error: "One or more generated letters were not found." }, { status: 404 });
    }

    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();
    archive.pipe(stream);

    for (const letter of result.rows) {
      enforceApplicantOwnership(user, dbUser.id, letter);
      const key = letter.pdf_storage_key ?? letter.docx_storage_key;
      archive.file(storagePath(key), { name: `${letter.id}.${letter.pdf_storage_key ? "pdf" : "docx"}` });
    }
    await audit("letters.downloaded_zip", "generated_letters", {
      generatedLetterIds: body.generatedLetterIds,
      fileCount: result.rows.length
    }, undefined, dbUser.id);
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
