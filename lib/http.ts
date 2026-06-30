import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authErrorResponse } from "@/lib/auth";

export function handleApiError(error: unknown) {
  const authResponse = authErrorResponse(error);
  if (authResponse) return authResponse;
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request.", issues: error.flatten() }, { status: 400 });
  }
  if (isPgUniqueViolation(error)) {
    return NextResponse.json({ error: "A conflicting record already exists." }, { status: 409 });
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
}

function isPgUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
