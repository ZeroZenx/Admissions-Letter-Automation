import test from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../lib/auth";
import { handleApiError } from "../lib/http";

test("handleApiError maps PostgreSQL unique violations to 409", async () => {
  const response = handleApiError({ code: "23505" });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.error, "A conflicting record already exists.");
});

test("handleApiError preserves typed bad-request errors", async () => {
  const response = handleApiError(new HttpError(400, "The workbook must include a worksheet named Admissions."));
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "The workbook must include a worksheet named Admissions.");
});

test("handleApiError masks unexpected server errors", async () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;

  try {
    const response = handleApiError(new Error("failed to read /srv/costaatt/private/generated.docx"));
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.error, "Unexpected server error.");
    assert.doesNotMatch(JSON.stringify(body), /\/srv\/costaatt\/private/);
  } finally {
    console.error = originalConsoleError;
  }
});
