import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  applicantIds: z.array(z.string().uuid()).min(1)
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const origin = new URL(request.url).origin;
  const results = [];

  for (const applicantId of body.applicantIds) {
    const response = await fetch(`${origin}/api/generate-letter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicantId, convertPdf: true })
    });
    results.push({ applicantId, ok: response.ok, result: await response.json() });
  }

  return NextResponse.json({ results });
}
