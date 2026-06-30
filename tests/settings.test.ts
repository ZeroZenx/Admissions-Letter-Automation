import test from "node:test";
import assert from "node:assert/strict";
import { defaultSettings } from "../lib/settings";

test("defaultSettings provides production email defaults", () => {
  assert.equal(defaultSettings.email.defaultSubject, "Your COSTAATT admissions letter");
  assert.match(defaultSettings.email.defaultBody, /admissions letter attached/);
  assert.equal(defaultSettings.pdf.converter, "libreoffice");
});
