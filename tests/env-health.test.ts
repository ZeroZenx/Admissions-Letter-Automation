import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("health check validates browser Entra and Graph send configuration", async () => {
  const healthSource = await readFile("app/api/health/route.ts", "utf8");
  const envSource = await readFile("lib/env.ts", "utf8");

  assert.match(envSource, /getClientAuthEnv/);
  assert.match(envSource, /NEXT_PUBLIC_GRAPH_SCOPES/);
  assert.match(envSource, /Mail\.Send/);
  assert.match(healthSource, /checks\.clientAuth/);
  assert.match(healthSource, /graphScopes=/);
});

test("health check proves storage and PDF converter runtime readiness", async () => {
  const healthSource = await readFile("app/api/health/route.ts", "utf8");

  assert.match(healthSource, /verifyStorageWritable/);
  assert.match(healthSource, /writeFile\(probePath, "ok"\)/);
  assert.match(healthSource, /unlink\(probePath\)/);
  assert.match(healthSource, /verifySofficeAvailable/);
  assert.match(healthSource, /execFileAsync\(soffice, \["--version"\], \{ timeout: 5000 \}\)/);
  assert.match(healthSource, /checks\.storage = \{ ok: true, detail: "writable" \}/);
  assert.doesNotMatch(healthSource, /detail: storage\.APP_STORAGE_DIR/);
});

test("health check fails when required database schema is missing", async () => {
  const healthSource = await readFile("app/api/health/route.ts", "utf8");
  const readme = await readFile("README.md", "utf8");
  const checklist = await readFile("docs/production-readiness.md", "utf8");

  assert.match(healthSource, /verifyDatabaseSchema/);
  assert.match(healthSource, /information_schema\.tables/);
  assert.match(healthSource, /information_schema\.columns/);
  assert.match(healthSource, /Missing tables:/);
  assert.match(healthSource, /Missing columns:/);
  assert.match(healthSource, /Run npm run db:setup/);
  assert.match(healthSource, /app_settings/);
  assert.match(healthSource, /applicants", "email_status"/);
  assert.match(healthSource, /generated_letters", "pdf_storage_key"/);
  assert.match(readme, /schema readiness/);
  assert.match(checklist, /database schema readiness/);
});

test("health check redacts path and database details from failure output", async () => {
  const healthSource = await readFile("app/api/health/route.ts", "utf8");
  const checklist = await readFile("docs/production-readiness.md", "utf8");

  assert.match(healthSource, /redactSensitiveDetail/);
  assert.match(healthSource, /redacted-database-url/);
  assert.match(healthSource, /redacted-path/);
  assert.match(checklist, /Health failure details are redacted/);
});
