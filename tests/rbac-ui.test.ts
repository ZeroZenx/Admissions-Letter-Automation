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
  assert.match(source, /canManageWorkspace \? authenticatedFetch\(`\/api\/audit-logs\?\$\{pageQuery\(pages\.auditLogs\)\}`\) : Promise\.resolve\(null\)/);
  assert.match(source, /active === "email" && \(/);
  assert.match(source, /canSend=\{canOperateLetters\}/);
  assert.match(source, /canSelect=\{canOperateLetters\}/);
  assert.match(source, /selected=\{canSelect \? selected : undefined\}/);
  assert.match(source, /\{canSend \? \(/);
  assert.match(source, /canDownload=\{canSend\}/);
  assert.match(source, /\{canDownload \? <th>Downloads<\/th> : null\}/);
});

test("workspace UI exposes bounded pagination controls for list pages", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");
  const styles = await readFile("app/globals.css", "utf8");

  assert.match(source, /type PageState = \{\n\s+limit: number;\n\s+offset: number;\n\}/);
  assert.match(source, /const initialPages: Record<PageKey, PageState>/);
  assert.match(source, /applyPageQuery\(query, pages\.applicants\)/);
  assert.match(source, /authenticatedFetch\(`\/api\/generated-letters\?\$\{pageQuery\(pages\.generatedLetters\)\}`\)/);
  assert.match(source, /authenticatedFetch\(`\/api\/email-logs\?\$\{pageQuery\(pages\.emailLogs\)\}`\)/);
  assert.match(source, /authenticatedFetch\(`\/api\/imports\?\$\{pageQuery\(pages\.imports\)\}&archived=\$\{showArchivedImports\}`\)/);
  assert.match(source, /mergePage\(current, "applicants", body\.page\)/);
  assert.match(source, /function PaginationControls/);
  assert.match(source, /<PaginationControls page=\{page\} loadedCount=\{applicants\.length\} onPage=\{onPage\} \/>/);
  assert.match(source, /<PaginationControls page=\{page\} loadedCount=\{generatedLetters\.length\} onPage=\{onPage\} \/>/);
  assert.match(source, /<PaginationControls page=\{page\} loadedCount=\{emailLogs\.length\} onPage=\{onPage\} \/>/);
  assert.match(source, /<PaginationControls page=\{page\} loadedCount=\{auditLogs\.length\} onPage=\{onPage\} \/>/);
  assert.match(source, /onPage\(\{ \.\.\.page, offset: Math\.max\(0, page\.offset - page\.limit\) \}\)/);
  assert.match(source, /onPage\(\{ \.\.\.page, offset: page\.offset \+ page\.limit \}\)/);
  assert.match(styles, /\.pagination/);
  assert.match(styles, /\.icon-button/);
});

test("workspace UI makes cross-page applicant selection explicit", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");
  const styles = await readFile("app/globals.css", "utf8");

  assert.match(source, /function SelectionSummary/);
  assert.match(source, /visibleSelectedCount = applicants\.filter\(\(applicant\) => selected\.includes\(applicant\.id\)\)\.length/);
  assert.match(source, /hiddenSelectedCount = selected\.length - visibleSelectedCount/);
  assert.match(source, /outside the current page or filters/);
  assert.match(source, /aria-label="Select all visible applicants"/);
  assert.match(source, /function toggleVisible\(\)/);
  assert.match(source, /onSelected\(\[\.{3}selected, \.{3}visibleIds\.filter\(\(id\) => !selected\.includes\(id\)\)\]\)/);
  assert.match(source, /onSelected\(selected\.filter\(\(id\) => !visibleIds\.includes\(id\)\)\)/);
  assert.match(source, /Clear Selection/);
  assert.match(styles, /\.selection-summary/);
});

test("workspace refresh failures are shown instead of crashing the client", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /const refresh = useCallback\(async \(\) => \{/);
  assert.match(source, /try \{\n\s+const query = new URLSearchParams/);
  assert.match(source, /catch \(error\) \{\n\s+setMessage\(`Dashboard refresh failed: \$\{clientErrorMessage\(error\)\}`\);/);
  assert.match(source, /const refreshSettings = useCallback\(async \(\) => \{/);
  assert.match(source, /Settings could not be loaded: \$\{clientErrorMessage\(error\)\}/);
});
