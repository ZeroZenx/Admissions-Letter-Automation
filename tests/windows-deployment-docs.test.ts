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
  assert.match(guide, /npm run validate/);
  assert.match(guide, /npm run start:6001/);
  assert.match(guide, /Arguments: run start:6001/);
  assert.match(guide, /https:\/\/admissions\.example\.edu\/login/);
  assert.match(guide, /APP_BASE_URL` and `NEXT_PUBLIC_ENTRA_REDIRECT_URI` set to that same public origin/);
  assert.match(guide, /listens on all VM network interfaces/);
  assert.match(guide, /Windows Firewall/);
  assert.match(guide, /installs and activates all six supplied Word templates/);
  assert.match(guide, /Windows service manager/);
});

test("Windows VM deployment guide is linked from operator docs", async () => {
  const readme = await readFile("README.md", "utf8");
  const checklist = await readFile("docs/production-readiness.md", "utf8");

  assert.match(readme, /docs\/windows-vm-deployment\.md/);
  assert.match(readme, /npm run dev -- -p 6001/);
  assert.match(readme, /npm run validate/);
  assert.match(readme, /http:\/\/localhost:6001/);
  assert.match(checklist, /windows-vm-deployment\.md/);
  assert.match(checklist, /npm run validate/);
});
