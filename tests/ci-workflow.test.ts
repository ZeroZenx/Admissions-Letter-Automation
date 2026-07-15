import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("CI release gate builds the Docker image", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");

  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /npm audit --omit=dev/);
  assert.match(workflow, /docker build --tag costaatt-admissions-letter-automation:ci \./);
});

test("CI validates the native application on Windows", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");

  assert.match(workflow, /windows-validate:/);
  assert.match(workflow, /runs-on: windows-latest/);
  assert.match(workflow, /SOFFICE_PATH: soffice\.exe/);
});
