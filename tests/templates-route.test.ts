import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseTemplateType } from "../lib/template-types";

test("template route supports audited activation lifecycle updates", async () => {
  const source = await readFile("app/api/templates/route.ts", "utf8");

  assert.match(source, /export async function PATCH/);
  assert.match(source, /requireAuth\(request, \["Admin", "Admissions Supervisor"\]\)/);
  assert.match(source, /isActive: z\.boolean\(\)/);
  assert.match(source, /UPDATE templates\s+SET is_active = \$1/);
  assert.match(source, /template\.status_updated/);
});

test("template uploads normalize and validate Banner template types", async () => {
  const source = await readFile("app/api/templates/route.ts", "utf8");

  assert.equal(parseTemplateType(" uoffer "), "UOFFER");
  assert.equal(parseTemplateType("condoffer_csec_pt"), "CONDOFFER_CSEC_PT");
  assert.throws(() => parseTemplateType("bad template!"), /templateType must contain only/);
  assert.match(source, /const name = String\(formData\.get\("name"\) \|\| ""\)\.trim\(\)/);
  assert.match(source, /const templateTypeInput = String\(formData\.get\("templateType"\) \|\| ""\)/);
  assert.match(source, /const templateType = parseTemplateType\(templateTypeInput\)/);
  assert.match(source, /templateType,/);
});

test("template uploads auto-map placeholders that match Banner fields", async () => {
  const source = await readFile("app/api/templates/route.ts", "utf8");
  const readme = await readFile("README.md", "utf8");

  assert.match(source, /import \{ mappableLetterFields \} from "@\/lib\/banner-fields"/);
  assert.match(source, /const exactMappings = placeholders\.filter/);
  assert.match(source, /mappableLetterFields\.includes/);
  assert.match(source, /INSERT INTO field_mappings \(template_id, placeholder, banner_field\)/);
  assert.match(source, /ON CONFLICT \(template_id, placeholder\) DO UPDATE SET banner_field = EXCLUDED\.banner_field/);
  assert.match(source, /autoMappedCount: exactMappings\.length/);
  assert.match(readme, /Template placeholders that exactly match Banner or derived letter fields are auto-mapped on upload/);
});
