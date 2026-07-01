import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Windows VM deployment guide documents native installation", async () => {
  const guide = await readFile("docs/windows-vm-deployment.md", "utf8");

  assert.match(guide, /Node\.js 22 LTS/);
  assert.match(guide, /PostgreSQL 16/);
  assert.match(guide, /LibreOffice/);
  assert.match(guide, /SOFFICE_PATH=C:\/Program Files\/LibreOffice\/program\/soffice\.exe/);
  assert.match(guide, /APP_STORAGE_DIR=C:\/COSTAATT\/AdmissionsLetterStorage/);
  assert.match(guide, /npm run start -- -H 127\.0\.0\.1 -p 6001/);
  assert.match(guide, /Windows service manager/);
});

test("Windows VM deployment guide is linked from operator docs", async () => {
  const readme = await readFile("README.md", "utf8");
  const checklist = await readFile("docs/production-readiness.md", "utf8");

  assert.match(readme, /docs\/windows-vm-deployment\.md/);
  assert.match(checklist, /windows-vm-deployment\.md/);
});
