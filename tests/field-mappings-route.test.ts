import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("field mapping updates validate Banner fields and audit the acting user", async () => {
  const source = await readFile("app/api/field-mappings/route.ts", "utf8");

  assert.match(source, /import \{ mappableLetterFields \} from "@\/lib\/banner-fields"/);
  assert.match(source, /bannerField: z\.enum\(mappableLetterFields\)/);
  assert.match(source, /const user = await requireAuth\(request, \["Admin", "Admissions Supervisor"\]\)/);
  assert.match(source, /const dbUser = await ensureDbUser\(user\)/);
  assert.match(source, /SELECT placeholders FROM templates WHERE id = \$1/);
  assert.match(source, /Template not found\./);
  assert.match(source, /duplicateMappingPlaceholders\(body\.mappings\)/);
  assert.match(source, /Mappings include duplicate placeholders/);
  assert.match(source, /templatePlaceholderNames\(template\.placeholders\)/);
  assert.match(source, /Mappings include placeholders not detected in the template/);
  assert.match(source, /Mappings are missing detected placeholders/);
  assert.match(source, /field_mappings\.updated/);
  assert.match(source, /body\.templateId, dbUser\.id\)/);
});

test("field mapping updates only accept placeholders detected on the template", async () => {
  const source = await readFile("app/api/field-mappings/route.ts", "utf8");

  assert.match(source, /function templatePlaceholderNames\(placeholders: unknown\)/);
  assert.match(source, /Array\.isArray\(placeholders\)/);
  assert.match(source, /"name" in placeholder/);
  assert.match(source, /unknownPlaceholders = body\.mappings/);
  assert.match(source, /!allowedPlaceholders\.has\(placeholder\)/);
  assert.match(source, /throw new HttpError\(400, `Mappings include placeholders not detected in the template:/);

  const validationIndex = source.indexOf("Mappings include placeholders not detected in the template");
  const transactionIndex = source.indexOf("await withTransaction");

  assert.ok(validationIndex > -1);
  assert.ok(transactionIndex > validationIndex);
});

test("field mapping updates reject duplicate placeholder mappings before saving", async () => {
  const source = await readFile("app/api/field-mappings/route.ts", "utf8");

  assert.match(source, /function duplicateMappingPlaceholders\(mappings: Array<\{ placeholder: string \}>\)/);
  assert.match(source, /const seen = new Set<string>\(\)/);
  assert.match(source, /const duplicates = new Set<string>\(\)/);
  assert.match(source, /duplicates\.add\(mapping\.placeholder\)/);
  assert.match(source, /throw new HttpError\(400, `Mappings include duplicate placeholders:/);

  const duplicateIndex = source.indexOf("Mappings include duplicate placeholders");
  const transactionIndex = source.indexOf("await withTransaction");
  assert.ok(duplicateIndex > -1);
  assert.ok(transactionIndex > duplicateIndex);
});

test("field mapping updates require every detected placeholder before saving", async () => {
  const source = await readFile("app/api/field-mappings/route.ts", "utf8");

  assert.match(source, /const mappedPlaceholders = new Set\(body\.mappings\.map\(\(mapping\) => mapping\.placeholder\)\)/);
  assert.match(source, /missingPlaceholders = \[\.{3}allowedPlaceholders\]\.filter/);
  assert.match(source, /!mappedPlaceholders\.has\(placeholder\)/);
  assert.match(source, /throw new HttpError\(400, `Mappings are missing detected placeholders:/);

  const missingIndex = source.indexOf("Mappings are missing detected placeholders");
  const transactionIndex = source.indexOf("await withTransaction");
  assert.ok(missingIndex > -1);
  assert.ok(transactionIndex > missingIndex);
});

test("mapping UI prefills saved mappings and fallback values", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /fallbackValue: string \| null/);
  assert.match(source, /const mappingsByPlaceholder = new globalThis\.Map\(template\.mappings\.map/);
  assert.match(source, /const savedMapping = mappingsByPlaceholder\.get\(placeholder\.name\)/);
  assert.match(source, /defaultValue=\{savedMapping\?\.bannerField \?\? defaultMappingField\(placeholder\.name\)\}/);
  assert.match(source, /defaultValue=\{savedMapping\?\.fallbackValue \?\? ""\}/);
});
