import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("audit logs expose actor identity for supervisor review", async () => {
  const routeSource = await readFile("app/api/audit-logs/route.ts", "utf8");
  const clientSource = await readFile("components/app-client.tsx", "utf8");

  assert.match(routeSource, /LEFT JOIN users u ON u\.id = al\.user_id/);
  assert.match(routeSource, /u\.display_name AS actor_name/);
  assert.match(routeSource, /u\.email AS actor_email/);
  assert.match(routeSource, /readPaginationParams\(url, \{ defaultLimit: listLimits\.auditLogs, maxLimit: listLimits\.auditLogs \}\)/);
  assert.match(routeSource, /LIMIT \$1 OFFSET \$2/);
  assert.match(routeSource, /page/);
  assert.match(clientSource, /actor_name: string \| null/);
  assert.match(clientSource, /actor_email: string \| null/);
  assert.match(clientSource, /<th>Actor<\/th>/);
  assert.match(clientSource, /log\.actor_name \?\? "System"/);
});

test("audit log details are sanitized before browser exposure", async () => {
  const routeSource = await readFile("app/api/audit-logs/route.ts", "utf8");
  const checklist = await readFile("docs/production-readiness.md", "utf8");

  assert.match(routeSource, /details: sanitizeAuditDetails\(row\.details\)/);
  assert.match(routeSource, /function sanitizeAuditDetails\(value: unknown\): unknown/);
  assert.match(routeSource, /function isSensitiveAuditKey\(key: string\)/);
  assert.match(routeSource, /access\)\?token\|authorization\|body\|content\|attachment\|storage_\?key\|path/);
  assert.match(routeSource, /redactSensitiveAuditText/);
  assert.match(routeSource, /redacted-database-url/);
  assert.match(routeSource, /redacted-path/);
  assert.match(checklist, /Audit log details are sanitized before being returned to the browser/);
});
