import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { mappableLetterFields } from "../lib/banner-fields";
import { generateDocxFromTemplate } from "../lib/docx-generate";
import { detectDocxPlaceholders } from "../lib/docx-placeholders";
import { buildLetterValues } from "../lib/letter-values";

type BundledTemplate = {
  name: string;
  templateType: string;
  fileName: string;
  mappings: Record<string, string>;
};

test("bundled templates cover every TemplateType in the supplied Banner workbook", async () => {
  const templates = await readManifest();
  assert.deepEqual(
    templates.map((template) => template.templateType).sort(),
    [
      "ACKNOWLEDGEMENT",
      "CFULFILLED_NOGATE",
      "CONDOFFER_CSEC_PT",
      "CONDOFFER_NURSING",
      "DFTEMPLATE",
      "UOFFER"
    ]
  );
});

test("every real DOCX placeholder has a valid bundled mapping", async () => {
  const templates = await readManifest();
  const allowedFields = new Set<string>(mappableLetterFields);

  for (const template of templates) {
    const buffer = await readFile(path.join("bundled-templates", template.fileName));
    const detected = detectDocxPlaceholders(buffer).map((placeholder) => placeholder.name).sort();
    const mapped = Object.keys(template.mappings).sort();
    assert.deepEqual(mapped, detected, `${template.templateType} mappings must exactly cover detected placeholders`);
    for (const bannerField of Object.values(template.mappings)) {
      assert.ok(allowedFields.has(bannerField), `${template.templateType} maps to unknown field ${bannerField}`);
    }
  }
});

test("every bundled template generates without unresolved placeholders", async () => {
  const templates = await readManifest();
  const rawData = Object.fromEntries(mappableLetterFields.map((field) => [field, `VALUE_${field}`]));

  for (const template of templates) {
    const input = await readFile(path.join("bundled-templates", template.fileName));
    const mappings = Object.entries(template.mappings).map(([placeholder, bannerField]) => ({
      placeholder,
      banner_field: bannerField,
      fallback_value: null
    }));
    const values = buildLetterValues({ raw_data: rawData }, mappings);
    const generated = generateDocxFromTemplate(input, values);

    assert.deepEqual(
      detectDocxPlaceholders(generated),
      [],
      `${template.templateType} generated with unresolved placeholders`
    );
  }
});

test("database setup installs bundled templates and preserves administrator replacements", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const installer = await readFile("scripts/install-bundled-templates.mjs", "utf8");
  const dockerfile = await readFile("Dockerfile", "utf8");

  assert.match(packageJson.scripts["db:setup"], /npm run templates:install/);
  assert.match(packageJson.scripts["templates:install"], /--env-file-if-exists=\.env\.local/);
  assert.match(installer, /isManagedStorageKey\(current\.storage_key\)/);
  assert.match(installer, /Preserved administrator template/);
  assert.match(installer, /verifyMappings\(template, placeholders\)/);
  assert.match(installer, /Installed bundled template/);
  assert.match(dockerfile, /\/app\/bundled-templates \.\/bundled-templates/);
});

async function readManifest() {
  return JSON.parse(await readFile("bundled-templates/manifest.json", "utf8")) as BundledTemplate[];
}
