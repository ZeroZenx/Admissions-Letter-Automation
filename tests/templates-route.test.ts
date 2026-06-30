import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("template route supports audited activation lifecycle updates", async () => {
  const source = await readFile("app/api/templates/route.ts", "utf8");

  assert.match(source, /export async function PATCH/);
  assert.match(source, /requireAuth\(request, \["Admin", "Admissions Supervisor"\]\)/);
  assert.match(source, /isActive: z\.boolean\(\)/);
  assert.match(source, /UPDATE templates\s+SET is_active = \$1/);
  assert.match(source, /template\.status_updated/);
});
