import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Microsoft Graph email sending has an explicit timeout", async () => {
  const source = await readFile("lib/graph-mail.ts", "utf8");

  assert.match(source, /export const GRAPH_SEND_TIMEOUT_MS = 30_000/);
  assert.match(source, /const timeoutMs = input\.timeoutMs \?\? GRAPH_SEND_TIMEOUT_MS/);
  assert.match(source, /signal: AbortSignal\.timeout\(timeoutMs\)/);
  assert.match(source, /Microsoft Graph sendMail timed out after \$\{timeoutMs\}ms\./);
  assert.match(source, /error\.name === "TimeoutError" \|\| error\.name === "AbortError"/);
});
