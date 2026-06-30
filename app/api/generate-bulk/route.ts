import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({
  applicantIds: z.array(z.string().uuid()).min(1)
});

export async function POST(request: Request) {
  try {
    await requireAuth(request, ["Admin", "Admissions Supervisor", "Counselor"]);
    const body = schema.parse(await request.json());
    const origin = new URL(request.url).origin;
    const authorization = request.headers.get("authorization");
    const devRole = request.headers.get("x-dev-role");
    const results = [];

    for (const applicantId of body.applicantIds) {
      const response = await fetch(`${origin}/api/generate-letter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { Authorization: authorization } : {}),
          ...(devRole ? { "x-dev-role": devRole } : {})
        },
        body: JSON.stringify({ applicantId, convertPdf: true })
      });
      results.push({ applicantId, ok: response.ok, result: await response.json() });
    }

    return NextResponse.json({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
