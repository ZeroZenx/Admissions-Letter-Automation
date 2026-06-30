import test from "node:test";
import assert from "node:assert/strict";
import { formatBytes, uploadLimits } from "../lib/request-limits";

test("upload limits are explicit production controls", () => {
  assert.equal(uploadLimits.excelBytes, 10 * 1024 * 1024);
  assert.equal(uploadLimits.docxBytes, 15 * 1024 * 1024);
  assert.equal(uploadLimits.pdfAttachmentBytes, 10 * 1024 * 1024);
});

test("formatBytes renders MB values", () => {
  assert.equal(formatBytes(10 * 1024 * 1024), "10 MB");
  assert.equal(formatBytes(1536 * 1024), "1.5 MB");
});
