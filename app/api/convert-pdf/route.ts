import { NextResponse } from "next/server";
import { z } from "zod";
import { convertDocxToPdf } from "@/lib/pdf-converter";
import { query } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  generatedLetterId: z.string().uuid()
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const result = await query<{ docx_storage_key: string }>("SELECT docx_storage_key FROM generated_letters WHERE id = $1", [
    body.generatedLetterId
  ]);
  const letter = result.rows[0];
  if (!letter) return NextResponse.json({ error: "Generated letter not found." }, { status: 404 });

  const pdfStorageKey = await convertDocxToPdf(letter.docx_storage_key);
  await query("UPDATE generated_letters SET pdf_storage_key = $1, status = 'pdf_generated' WHERE id = $2", [
    pdfStorageKey,
    body.generatedLetterId
  ]);
  return NextResponse.json({ pdfReady: true });
}
