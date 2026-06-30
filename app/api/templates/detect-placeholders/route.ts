import { NextResponse } from "next/server";
import { detectDocxPlaceholders } from "@/lib/docx-placeholders";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a DOCX template using the file field." }, { status: 400 });
  }

  const placeholders = detectDocxPlaceholders(Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ placeholders });
}
