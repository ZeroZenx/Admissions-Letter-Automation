import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("audit logs expose actor identity for supervisor review", async () => {
  const routeSource = await readFile("app/api/audit-logs/route.ts", "utf8");
  const clientSource = await readFile("components/app-client.tsx", "utf8");

  assert.match(routeSource, /LEFT JOIN users u ON u\.id = al\.user_id/);
  assert.match(routeSource, /u\.display_name AS actor_name/);
  assert.match(routeSource, /u\.email AS actor_email/);
  assert.match(clientSource, /actor_name: string \| null/);
  assert.match(clientSource, /actor_email: string \| null/);
  assert.match(clientSource, /<th>Actor<\/th>/);
  assert.match(clientSource, /log\.actor_name \?\? "System"/);
});
