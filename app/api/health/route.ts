import { execFile } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getAuthEnv, getClientAuthEnv, getDbEnv, getPdfEnv, getStorageEnv } from "@/lib/env";
import { query } from "@/lib/db";
import { storagePath } from "@/lib/storage";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

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
    const clientAuth = getClientAuthEnv();
    checks.clientAuth = {
      ok: true,
      detail: `mode=${clientAuth.NEXT_PUBLIC_AUTH_MODE}; graphScopes=${clientAuth.graphScopes.join(" ")}`
    };
  } catch (error) {
    checks.clientAuth = { ok: false, detail: errorMessage(error) };
  }

  try {
    getDbEnv();
    await query("SELECT 1");
    checks.database = { ok: true };
  } catch (error) {
    checks.database = { ok: false, detail: errorMessage(error) };
  }

  try {
    getStorageEnv();
    await verifyStorageWritable();
    checks.storage = { ok: true, detail: "writable" };
  } catch (error) {
    checks.storage = { ok: false, detail: errorMessage(error) };
  }

  try {
    const pdf = getPdfEnv();
    const version = await verifySofficeAvailable(pdf.SOFFICE_PATH || "soffice");
    checks.pdf = { ok: true, detail: `${pdf.SOFFICE_PATH ? "custom" : "PATH"} soffice available${version ? `: ${version}` : ""}` };
  } catch (error) {
    checks.pdf = { ok: false, detail: errorMessage(error) };
  }

  const ok = Object.values(checks).every((check) => check.ok);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return redactSensitiveDetail(message);
}

function redactSensitiveDetail(message: string) {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[redacted-database-url]")
    .replace(/[A-Z]:[\\/][^\s"'<>]+/g, "[redacted-path]")
    .replace(/\/(?:Users|var|private|tmp|app|srv|opt|etc|home)\/[^\s"'<>]+/g, "[redacted-path]");
}

async function verifyStorageWritable() {
  const probePath = storagePath(path.join(".health", `probe-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`));
  await mkdir(path.dirname(probePath), { recursive: true });
  await writeFile(probePath, "ok");
  await unlink(probePath);
}

async function verifySofficeAvailable(soffice: string) {
  const { stdout } = await execFileAsync(soffice, ["--version"], { timeout: 5000 });
  return stdout.toString().split(/\r?\n/)[0]?.trim();
}
