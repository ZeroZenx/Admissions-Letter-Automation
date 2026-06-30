import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { readStorageBuffer } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const url = new URL(request.url);
    const type = url.searchParams.get("type") === "docx" ? "docx" : "pdf";
    const column = type === "docx" ? "docx_storage_key" : "pdf_storage_key";
    const result = await query<Record<string, string>>(`SELECT ${column} FROM generated_letters WHERE id = $1`, [id]);
    const key = result.rows[0]?.[column];
    if (!key) return NextResponse.json({ error: "File not found." }, { status: 404 });

    const buffer = await readStorageBuffer(key);
    const contentType =
      type === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${id}.${type}"`
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
