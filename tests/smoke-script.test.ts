import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("smoke script verifies served Next.js JavaScript chunks", async () => {
  const smokeScript = await readFile("scripts/smoke.mjs", "utf8");

  assert.match(smokeScript, /http:\/\/127\.0\.0\.1:6001/);
  assert.match(smokeScript, /assertStaticJavaScriptChunks/);
  assert.match(smokeScript, /_next\\\/static\\\/chunks/);
  assert.match(smokeScript, /no Next\.js JavaScript chunks found/);
  assert.match(smokeScript, /static JavaScript chunk/);
  assert.match(smokeScript, /new URL\(path, baseUrl\)/);
});
