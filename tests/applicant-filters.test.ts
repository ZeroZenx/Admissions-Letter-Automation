import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { HttpError } from "../lib/auth";
import { applicantFilterClauses, readApplicantFilters } from "../lib/applicant-filters";

test("applicant filters validate operational values before querying", () => {
  const url = new URL(
    "http://localhost/api/applicants?templateType= uoffer &emailStatus=Sent&admissionStatus=Admitted&campus=City&program=Nursing"
  );
  const filters = readApplicantFilters(url);

  assert.deepEqual(filters, {
    templateType: "UOFFER",
    emailStatus: "Sent",
    admissionStatus: "Admitted",
    campus: "City",
    program: "Nursing"
  });

  const params: unknown[] = [];
  assert.deepEqual(applicantFilterClauses(filters, params), [
    "template_type = $1",
    "admission_status = $2",
    "email_status = $3",
    "campus = $4",
    "program = $5"
  ]);
  assert.deepEqual(params, ["UOFFER", "Admitted", "Sent", "City", "Nursing"]);
});

test("applicant filters reject invalid values", () => {
  assert.throws(
    () => readApplicantFilters(new URL("http://localhost/api/applicants?templateType=bad type!")),
    (error) => error instanceof HttpError && error.status === 400 && error.message.includes("templateType must contain only")
  );
  assert.throws(
    () => readApplicantFilters(new URL("http://localhost/api/applicants?emailStatus=Delivered")),
    (error) => error instanceof HttpError && error.status === 400 && error.message.includes("emailStatus must be one of")
  );
  assert.throws(
    () => readApplicantFilters(new URL(`http://localhost/api/applicants?program=${"A".repeat(201)}`)),
    (error) => error instanceof HttpError && error.status === 400 && error.message.includes("program must be 200 characters")
  );
});

test("applicant list and export routes share validated filters", async () => {
  const listSource = await readFile("app/api/applicants/route.ts", "utf8");
  const exportSource = await readFile("app/api/applicants/export/route.ts", "utf8");

  assert.match(listSource, /readApplicantFilters\(url\)/);
  assert.match(listSource, /applicantFilterClauses\(readApplicantFilters\(url\), params\)/);
  assert.match(exportSource, /const filters = readApplicantFilters\(url\)/);
  assert.match(exportSource, /applicantFilterClauses\(filters, params\)/);
  assert.match(exportSource, /filters\s*\n\s*\}, undefined, dbUser\.id\)/);
  assert.doesNotMatch(exportSource, /Object\.fromEntries\(url\.searchParams\.entries\(\)\)/);
});
