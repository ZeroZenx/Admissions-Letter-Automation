import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("field mapping updates validate Banner fields and audit the acting user", async () => {
  const source = await readFile("app/api/field-mappings/route.ts", "utf8");

  assert.match(source, /import \{ mappableLetterFields \} from "@\/lib\/banner-fields"/);
  assert.match(source, /bannerField: z\.enum\(mappableLetterFields\)/);
  assert.match(source, /const user = await requireAuth\(request, \["Admin", "Admissions Supervisor"\]\)/);
  assert.match(source, /const dbUser = await ensureDbUser\(user\)/);
  assert.match(source, /field_mappings\.updated/);
  assert.match(source, /body\.templateId, dbUser\.id\)/);
});

test("mapping UI prefills saved mappings and fallback values", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /fallbackValue: string \| null/);
  assert.match(source, /const mappingsByPlaceholder = new globalThis\.Map\(template\.mappings\.map/);
  assert.match(source, /const savedMapping = mappingsByPlaceholder\.get\(placeholder\.name\)/);
  assert.match(source, /defaultValue=\{savedMapping\?\.bannerField \?\? defaultMappingField\(placeholder\.name\)\}/);
  assert.match(source, /defaultValue=\{savedMapping\?\.fallbackValue \?\? ""\}/);
});
