import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("health check validates browser Entra and Graph send configuration", async () => {
  const healthSource = await readFile("app/api/health/route.ts", "utf8");
  const envSource = await readFile("lib/env.ts", "utf8");

  assert.match(envSource, /getClientAuthEnv/);
  assert.match(envSource, /NEXT_PUBLIC_GRAPH_SCOPES/);
  assert.match(envSource, /Mail\.Send/);
  assert.match(healthSource, /checks\.clientAuth/);
  assert.match(healthSource, /graphScopes=/);
});
