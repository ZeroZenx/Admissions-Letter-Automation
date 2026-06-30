import test from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../lib/auth";
import { counselorApplicantWhereClause, enforceApplicantOwnership } from "../lib/user-context";

const counselor = {
  id: "oid-1",
  email: "counselor@example.edu",
  displayName: "Counselor",
  roles: ["Counselor" as const]
};

test("enforceApplicantOwnership allows counselors when no owner is configured", () => {
  assert.doesNotThrow(() => enforceApplicantOwnership(counselor, "user-1", { student_id: "A1", counselor_user_id: null }));
});

test("enforceApplicantOwnership allows assigned counselors", () => {
  assert.doesNotThrow(() => enforceApplicantOwnership(counselor, "user-1", { student_id: "A1", counselor_user_id: "user-1" }));
});

test("enforceApplicantOwnership blocks counselors assigned to someone else", () => {
  assert.throws(
    () => enforceApplicantOwnership(counselor, "user-1", { student_id: "A1", counselor_user_id: "user-2" }),
    (error) => error instanceof HttpError && error.status === 403
  );
});

test("counselorApplicantWhereClause filters assigned or unassigned applicants", () => {
  const where = counselorApplicantWhereClause(counselor, "user-1", 3);

  assert.equal(where.clause, "(counselor_user_id IS NULL OR counselor_user_id = $3)");
  assert.deepEqual(where.params, ["user-1"]);
});

test("counselorApplicantWhereClause does not filter supervisors", () => {
  const where = counselorApplicantWhereClause(
    {
      id: "oid-2",
      email: "supervisor@example.edu",
      displayName: "Supervisor",
      roles: ["Admissions Supervisor"]
    },
    "user-2",
    1
  );

  assert.equal(where.clause, "");
  assert.deepEqual(where.params, []);
});
