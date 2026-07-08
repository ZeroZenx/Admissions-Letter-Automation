import test from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../lib/auth";
import { listLimits as sharedListLimits, uploadLimits as sharedUploadLimits } from "../lib/limits";
import { formatBytes, listLimits, readPaginationParams, uploadLimits } from "../lib/request-limits";

test("upload limits are explicit production controls", () => {
  assert.strictEqual(uploadLimits, sharedUploadLimits);
  assert.strictEqual(listLimits, sharedListLimits);
  assert.equal(uploadLimits.excelBytes, 10 * 1024 * 1024);
  assert.equal(uploadLimits.docxBytes, 15 * 1024 * 1024);
  assert.equal(uploadLimits.pdfAttachmentBytes, 10 * 1024 * 1024);
  assert.equal(uploadLimits.bulkApplicantIds, 2000);
  assert.equal(uploadLimits.zipGeneratedLetterIds, 200);
  assert.equal(uploadLimits.statusExportRows, 10000);
  assert.equal(listLimits.applicants, 500);
  assert.equal(listLimits.generatedLetters, 200);
  assert.equal(listLimits.emailLogs, 500);
  assert.equal(listLimits.auditLogs, 500);
  assert.equal(listLimits.imports, 100);
  assert.equal(listLimits.maxOffset, 10000);
});

test("formatBytes renders MB values", () => {
  assert.equal(formatBytes(10 * 1024 * 1024), "10 MB");
  assert.equal(formatBytes(1536 * 1024), "1.5 MB");
});

test("readPaginationParams returns bounded list paging controls", () => {
  const url = new URL("http://localhost/api/applicants?limit=25&offset=50");

  assert.deepEqual(readPaginationParams(url, { defaultLimit: 500, maxLimit: 500 }), {
    limit: 25,
    offset: 50
  });
});

test("readPaginationParams rejects invalid list paging controls", () => {
  assert.throws(
    () => readPaginationParams(new URL("http://localhost/api/applicants?limit=501"), { defaultLimit: 500, maxLimit: 500 }),
    (error) => error instanceof HttpError && error.status === 400 && error.message.includes("limit must be")
  );
  assert.throws(
    () => readPaginationParams(new URL("http://localhost/api/applicants?offset=-1"), { defaultLimit: 500, maxLimit: 500 }),
    (error) => error instanceof HttpError && error.status === 400 && error.message.includes("offset must be")
  );
});
