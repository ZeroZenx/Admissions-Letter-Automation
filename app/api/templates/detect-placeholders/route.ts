import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { detectDocxPlaceholders } from "@/lib/docx-placeholders";
import { handleApiError } from "@/lib/http";
import { uploadLimits, validateFileSize } from "@/lib/request-limits";
import { parseUploadFileName } from "@/lib/upload-file-names";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAuth(request, ["Admin", "Admissions Supervisor"]);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a DOCX template using the file field." }, { status: 400 });
    }
    parseUploadFileName(file.name, {
      allowedExtensions: [".docx"],
      label: "DOCX template",
      extensionError: "Only DOCX template uploads are allowed."
    });
    const sizeError = validateFileSize(file, uploadLimits.docxBytes, "DOCX template");
    if (sizeError) return sizeError;

    const placeholders = detectDocxPlaceholders(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ placeholders });
  } catch (error) {
    return handleApiError(error);
  }
}
