import { NextResponse } from "next/server";
import { getAuthEnv, getDbEnv, getPdfEnv, getStorageEnv } from "@/lib/env";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    const auth = getAuthEnv();
    checks.auth = {
      ok: auth.AUTH_MODE === "development" || Boolean(auth.ENTRA_TENANT_ID && auth.ENTRA_CLIENT_ID),
      detail: `mode=${auth.AUTH_MODE}`
    };
  } catch (error) {
    checks.auth = { ok: false, detail: errorMessage(error) };
  }

  try {
    getDbEnv();
    await query("SELECT 1");
    checks.database = { ok: true };
  } catch (error) {
    checks.database = { ok: false, detail: errorMessage(error) };
  }

  try {
    const storage = getStorageEnv();
    checks.storage = { ok: true, detail: storage.APP_STORAGE_DIR };
  } catch (error) {
    checks.storage = { ok: false, detail: errorMessage(error) };
  }

  try {
    const pdf = getPdfEnv();
    checks.pdf = { ok: true, detail: pdf.SOFFICE_PATH ? "custom soffice path configured" : "using PATH soffice" };
  } catch (error) {
    checks.pdf = { ok: false, detail: errorMessage(error) };
  }

  const ok = Object.values(checks).every((check) => check.ok);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
