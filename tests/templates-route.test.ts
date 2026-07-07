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

test("template list only exposes mappings to template managers", async () => {
  const source = await readFile("app/api/templates/route.ts", "utf8");
  const checklist = await readFile("docs/production-readiness.md", "utf8");

  assert.match(source, /const user = await requireAuth\(request\)/);
  assert.match(source, /const canManageMappings = user\.roles\.some/);
  assert.match(source, /\["Admin", "Admissions Supervisor"\]\.includes\(role\)/);
  assert.match(source, /canManageMappings\s+\?/);
  assert.match(source, /json_build_object\('placeholder', fm\.placeholder, 'bannerField', fm\.banner_field, 'fallbackValue', fm\.fallback_value\)/);
  assert.match(source, /'\[\]'::json AS mappings/);
  assert.match(checklist, /Template mapping fallback values are only exposed to Admin and Admissions Supervisor roles/);
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
  assert.match(source, /import \{ query, withTransaction \} from "@\/lib\/db"/);
  assert.match(source, /import \{ detectDocxPlaceholders, normalizePlaceholder \} from "@\/lib\/docx-placeholders"/);
  assert.match(source, /const placeholderNames = placeholders\.map\(\(placeholder\) => placeholder\.name\)/);
  assert.match(source, /const templateId = await withTransaction/);
  assert.match(source, /const autoMappableFields = new Map/);
  assert.match(source, /const autoMappings = placeholders/);
  assert.match(source, /autoMappableFields\.get\(autoMapKey\(placeholder\.name\)\)/);
  assert.match(source, /INSERT INTO field_mappings \(template_id, placeholder, banner_field\)/);
  assert.match(source, /VALUES \(\$1, \$2, \$3\)/);
  assert.match(source, /ON CONFLICT \(template_id, placeholder\) DO UPDATE SET banner_field = EXCLUDED\.banner_field/);
  assert.match(source, /autoMappedCount: autoMappings\.length/);
  assert.match(source, /normalizePlaceholder\(value\)\.replace\(\/_\/g, ""\)\.toLowerCase\(\)/);
  assert.match(readme, /Template placeholders that normalize to Banner or derived letter fields are auto-mapped on upload/);
});

test("template re-uploads prune mappings for removed placeholders", async () => {
  const source = await readFile("app/api/templates/route.ts", "utf8");

  assert.match(source, /DELETE FROM field_mappings WHERE template_id = \$1 AND NOT \(placeholder = ANY\(\$2::text\[\]\)\)/);
  assert.match(source, /\[\s*id,\s*placeholderNames\s*\]/);
  assert.match(source, /return id;/);

  const pruneIndex = source.indexOf("DELETE FROM field_mappings WHERE template_id");
  const autoMapIndex = source.indexOf("INSERT INTO field_mappings (template_id, placeholder, banner_field)");
  const auditIndex = source.indexOf('audit("template.upserted"');

  assert.ok(pruneIndex > -1);
  assert.ok(autoMapIndex > pruneIndex);
  assert.ok(auditIndex > autoMapIndex);
});
