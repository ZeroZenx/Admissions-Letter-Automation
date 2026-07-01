import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("CSP allows Next.js app router bootstrap scripts", async () => {
  const source = await readFile("middleware.ts", "utf8");

  assert.match(source, /script-src 'self' 'unsafe-inline'/);
  assert.match(source, /frame-ancestors 'none'/);
  assert.match(source, /connect-src 'self' https:\/\/login\.microsoftonline\.com https:\/\/graph\.microsoft\.com/);
});
