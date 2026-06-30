import test from "node:test";
import assert from "node:assert/strict";
import { handleApiError } from "../lib/http";

test("handleApiError maps PostgreSQL unique violations to 409", async () => {
  const response = handleApiError({ code: "23505" });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.error, "A conflicting record already exists.");
});
