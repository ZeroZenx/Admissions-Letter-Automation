import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authErrorResponse } from "@/lib/auth";

export function handleApiError(error: unknown) {
  const authResponse = authErrorResponse(error);
  if (authResponse) return authResponse;
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request.", issues: error.flatten() }, { status: 400 });
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
}
