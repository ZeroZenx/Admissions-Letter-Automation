import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("email log endpoint returns operational send history without message bodies", async () => {
  const source = await readFile("app/api/email-logs/route.ts", "utf8");

  assert.match(source, /FROM email_logs el/);
  assert.match(source, /JOIN applicants a ON a\.id = el\.applicant_id/);
  assert.match(source, /counselorApplicantWhereClause/);
  assert.match(source, /recipient, el\.subject/);
  assert.doesNotMatch(source, /el\.body/);
  assert.match(source, /ORDER BY el\.created_at DESC/);
  assert.match(source, /readPaginationParams\(url, \{ defaultLimit: listLimits\.emailLogs, maxLimit: listLimits\.emailLogs \}\)/);
  assert.match(source, /LIMIT \$\$\{params\.length \+ 1\} OFFSET \$\$\{params\.length \+ 2\}/);
  assert.match(source, /return NextResponse\.json\(\{ emailLogs: result\.rows, page \}\)/);
});
