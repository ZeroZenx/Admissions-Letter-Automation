import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("example environment uses portable Windows-ready defaults", async () => {
  const example = await readFile(".env.example", "utf8");

  assert.match(example, /APP_BASE_URL=http:\/\/localhost:6001/);
  assert.match(example, /NEXT_PUBLIC_ENTRA_REDIRECT_URI=http:\/\/localhost:6001/);
  assert.match(example, /SOFFICE_PATH=soffice/);
  assert.match(example, /ALLOW_INSECURE_DEVELOPMENT_AUTH=false/);
  assert.doesNotMatch(example, /\/Users\//);
  assert.doesNotMatch(example, /localhost:3000/);
});
