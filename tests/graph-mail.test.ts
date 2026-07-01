import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GRAPH_ERROR_DETAIL_LIMIT, formatGraphSendError } from "../lib/graph-mail";

test("Microsoft Graph email sending has an explicit timeout", async () => {
  const source = await readFile("lib/graph-mail.ts", "utf8");

  assert.match(source, /export const GRAPH_SEND_TIMEOUT_MS = 30_000/);
  assert.match(source, /const timeoutMs = input\.timeoutMs \?\? GRAPH_SEND_TIMEOUT_MS/);
  assert.match(source, /signal: AbortSignal\.timeout\(timeoutMs\)/);
  assert.match(source, /Microsoft Graph sendMail timed out after \$\{timeoutMs\}ms\./);
  assert.match(source, /error\.name === "TimeoutError" \|\| error\.name === "AbortError"/);
});

test("Microsoft Graph send errors are concise and bounded", () => {
  const formatted = formatGraphSendError(
    403,
    JSON.stringify({
      error: {
        code: "ErrorAccessDenied",
        message: "Access is denied.\nDetailed provider trace that should not keep formatting."
      }
    })
  );

  assert.equal(
    formatted,
    "Microsoft Graph sendMail failed with 403: Access is denied. Detailed provider trace that should not keep formatting."
  );

  const longFormatted = formatGraphSendError(500, "x".repeat(GRAPH_ERROR_DETAIL_LIMIT + 100));
  assert.equal(longFormatted.length, "Microsoft Graph sendMail failed with 500: ".length + GRAPH_ERROR_DETAIL_LIMIT);
  assert.match(longFormatted, /…$/);
});
