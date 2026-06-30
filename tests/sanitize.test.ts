import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeEmailHtml } from "../lib/sanitize";

test("sanitizeEmailHtml removes script tags and event handlers", () => {
  const sanitized = sanitizeEmailHtml(`<p onclick="steal()">Hello</p><script>alert(1)</script><a href="javascript:bad()">x</a>`);

  assert.equal(sanitized.includes("<script>"), false);
  assert.equal(sanitized.includes("onclick"), false);
  assert.equal(sanitized.includes("javascript:"), false);
  assert.match(sanitized, /Hello/);
});
