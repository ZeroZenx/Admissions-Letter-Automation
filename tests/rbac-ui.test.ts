import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("client auth exposes Entra roles for UI permissions", async () => {
  const source = await readFile("lib/client-auth.ts", "utf8");

  assert.match(source, /roles\?: ClientUserRole\[\]/);
  assert.match(source, /type ClientUserRole = "Admin" \| "Admissions Supervisor" \| "Counselor" \| "Viewer"/);
  assert.match(source, /account\.idTokenClaims as Record<string, unknown>/);
  assert.match(source, /claims\?\.roles \?\? claims\?\.role \?\? claims\?\.groups/);
  assert.match(source, /return parsed\.length \? parsed : \["Viewer"\]/);
});

test("workspace UI mirrors backend role boundaries", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /const canManageWorkspace = hasAnyRole\(userRoles, \["Admin", "Admissions Supervisor"\]\)/);
  assert.match(source, /const canOperateLetters = hasAnyRole\(userRoles, \["Admin", "Admissions Supervisor", "Counselor"\]\)/);
  assert.match(source, /section\.id === "upload" \|\| section\.id === "generate"/);
  assert.match(source, /section\.id === "templates" \|\| section\.id === "mappings" \|\| section\.id === "audit" \|\| section\.id === "settings"/);
  assert.match(source, /canManageWorkspace \? authenticatedFetch\("\/api\/audit-logs"\) : Promise\.resolve\(null\)/);
  assert.match(source, /active === "email" && \(/);
  assert.match(source, /canSend=\{canOperateLetters\}/);
  assert.match(source, /canSelect=\{canOperateLetters\}/);
  assert.match(source, /selected=\{canSelect \? selected : undefined\}/);
  assert.match(source, /\{canSend \? \(/);
  assert.match(source, /canDownload=\{canSend\}/);
  assert.match(source, /\{canDownload \? <th>Downloads<\/th> : null\}/);
});

test("workspace refresh failures are shown instead of crashing the client", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /const refresh = useCallback\(async \(\) => \{/);
  assert.match(source, /try \{\n\s+const query = new URLSearchParams/);
  assert.match(source, /catch \(error\) \{\n\s+setMessage\(`Dashboard refresh failed: \$\{clientErrorMessage\(error\)\}`\);/);
  assert.match(source, /const refreshSettings = useCallback\(async \(\) => \{/);
  assert.match(source, /Settings could not be loaded: \$\{clientErrorMessage\(error\)\}/);
});
