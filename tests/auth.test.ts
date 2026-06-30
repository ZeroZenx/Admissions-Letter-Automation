import test from "node:test";
import assert from "node:assert/strict";
import { HttpError, requireAuth } from "../lib/auth";

test("requireAuth allows development-mode role headers", async () => {
  process.env.AUTH_MODE = "development";
  process.env.DATABASE_URL = "postgres://example";

  const request = new Request("http://localhost/api/example", {
    headers: { "x-dev-role": "Counselor" }
  });
  const user = await requireAuth(request, ["Counselor"]);

  assert.equal(user.email, "admin@costaatt.edu.tt");
  assert.deepEqual(user.roles, ["Counselor"]);
});

test("requireAuth rejects development-mode users outside allowed roles", async () => {
  process.env.AUTH_MODE = "development";
  process.env.DATABASE_URL = "postgres://example";

  await assert.rejects(
    requireAuth(new Request("http://localhost/api/example", { headers: { "x-dev-role": "Viewer" } }), ["Admin"]),
    (error) => error instanceof HttpError && error.status === 403
  );
});
