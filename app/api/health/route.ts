import { execFile } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getAuthEnv, getClientAuthEnv, getDbEnv, getEncryptionEnv, getPdfEnv, getStorageEnv } from "@/lib/env";
import { query } from "@/lib/db";
import { getAppSettings, getStoredSmtpConfiguration } from "@/lib/settings";
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
    const settings = await getAppSettings();
    if (settings.email.provider === "smtp") {
      getEncryptionEnv();
      await getStoredSmtpConfiguration();
      checks.emailSender = { ok: true, detail: `provider=smtp; sender=${settings.email.senderEmail}` };
    } else {
      const clientAuth = getClientAuthEnv();
      if (clientAuth.NEXT_PUBLIC_AUTH_MODE === "entra" && !clientAuth.graphScopes.includes("Mail.Send")) {
        throw new Error("Microsoft Graph sender requires Mail.Send in NEXT_PUBLIC_GRAPH_SCOPES.");
      }
      checks.emailSender = { ok: true, detail: "provider=graph" };
    }
  } catch (error) {
    checks.emailSender = { ok: false, detail: errorMessage(error) };
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
    await verifyDatabaseSchema();
    checks.database = { ok: true, detail: "connected; schema ready" };
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

async function verifyDatabaseSchema() {
  const expectedTables = ["users", "imports", "applicants", "templates", "field_mappings", "generated_letters", "email_logs", "audit_logs", "app_settings", "email_sender_settings"];
  const tableResult = await query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])`,
    [expectedTables]
  );
  const existingTables = new Set(tableResult.rows.map((row) => row.table_name));
  const missingTables = expectedTables.filter((table) => !existingTables.has(table));
  if (missingTables.length) {
    throw new Error(`Database schema is incomplete. Run npm run db:setup. Missing tables: ${missingTables.join(", ")}.`);
  }

  const expectedColumns = [
    ["applicants", "email_status"],
    ["applicants", "sent_date"],
    ["applicants", "word_file_name"],
    ["applicants", "pdf_file_name"],
    ["applicants", "processed_by_flow"],
    ["applicants", "template_type"],
    ["generated_letters", "pdf_storage_key"],
    ["email_logs", "resend_reason"],
    ["audit_logs", "applicant_student_id"],
    ["imports", "archived_at"],
    ["email_logs", "provider"]
  ];
  const columnResult = await query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])`,
    [[...new Set(expectedColumns.map(([table]) => table))]]
  );
  const existingColumns = new Set(columnResult.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missingColumns = expectedColumns
    .map(([table, column]) => `${table}.${column}`)
    .filter((column) => !existingColumns.has(column));
  if (missingColumns.length) {
    throw new Error(`Database schema is incomplete. Run npm run db:setup. Missing columns: ${missingColumns.join(", ")}.`);
  }
}

async function verifySofficeAvailable(soffice: string) {
  const { stdout } = await execFileAsync(soffice, ["--version"], { timeout: 5000 });
  return stdout.toString().split(/\r?\n/)[0]?.trim();
}
