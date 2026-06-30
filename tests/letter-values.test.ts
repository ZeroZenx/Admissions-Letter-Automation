import test from "node:test";
import assert from "node:assert/strict";
import { buildLetterValues } from "../lib/letter-values";

test("buildLetterValues resolves mapped placeholders from raw Banner fields and fallback values", () => {
  const values = buildLetterValues(
    {
      raw_data: {
        FirstName: "Maya",
        LastName: "Singh",
        Program: "Nursing"
      }
    },
    [
      { placeholder: "ProgrammeName", banner_field: "Program", fallback_value: null },
      { placeholder: "MissingValue", banner_field: "DoesNotExist", fallback_value: "Fallback" }
    ]
  );

  assert.equal(values.ProgrammeName, "Nursing");
  assert.equal(values.MissingValue, "Fallback");
  assert.equal(values.FullName, "Maya Singh");
});
