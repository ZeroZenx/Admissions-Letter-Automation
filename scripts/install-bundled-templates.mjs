import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import PizZip from "pizzip";

const { Client } = pg;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundleRoot = path.join(projectRoot, "bundled-templates");
const manifest = JSON.parse(await readFile(path.join(bundleRoot, "manifest.json"), "utf8"));
const storageRoot = path.resolve(process.env.APP_STORAGE_DIR || path.join(projectRoot, "storage"));
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({ connectionString });
await client.connect();

try {
  for (const template of manifest) {
    const sourcePath = path.join(bundleRoot, template.fileName);
    const buffer = await readFile(sourcePath);
    const placeholders = detectDocxPlaceholders(buffer);
    verifyMappings(template, placeholders);

    await client.query("BEGIN");
    try {
      const existing = await client.query(
        "SELECT id, storage_key FROM templates WHERE template_type = $1 FOR UPDATE",
        [template.templateType]
      );
      const current = existing.rows[0];
      if (current && !isManagedStorageKey(current.storage_key)) {
        await client.query("ROLLBACK");
        console.log(`Preserved administrator template ${template.templateType}.`);
        continue;
      }

      const storageKey = `bundled/${template.fileName}`;
      await writeManagedFile(storageKey, buffer);
      const upsert = await client.query(
        `INSERT INTO templates (name, template_type, original_file_name, storage_key, placeholders, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (template_type) DO UPDATE SET
           name = EXCLUDED.name,
           original_file_name = EXCLUDED.original_file_name,
           storage_key = EXCLUDED.storage_key,
           placeholders = EXCLUDED.placeholders,
           is_active = true,
           uploaded_at = now()
         RETURNING id`,
        [template.name, template.templateType, template.fileName, storageKey, JSON.stringify(placeholders)]
      );
      const templateId = upsert.rows[0].id;
      await client.query("DELETE FROM field_mappings WHERE template_id = $1", [templateId]);
      for (const [placeholder, bannerField] of Object.entries(template.mappings)) {
        await client.query(
          `INSERT INTO field_mappings (template_id, placeholder, banner_field)
           VALUES ($1, $2, $3)`,
          [templateId, placeholder, bannerField]
        );
      }
      await client.query("COMMIT");
      console.log(`Installed bundled template ${template.templateType}.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  await client.query(
    `UPDATE templates
        SET is_active = false
      WHERE template_type = 'PA'
        AND storage_key = 'seed/Admission_Letter_Template_PA_AllFields.docx'`
  );
} finally {
  await client.end();
}

function isManagedStorageKey(storageKey) {
  return typeof storageKey === "string" && (storageKey.startsWith("seed/") || storageKey.startsWith("bundled/"));
}

async function writeManagedFile(storageKey, buffer) {
  const destination = path.resolve(storageRoot, storageKey);
  const relative = path.relative(storageRoot, destination);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Invalid bundled template storage key: ${storageKey}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, buffer);
  await rename(temporary, destination);
}

function verifyMappings(template, placeholders) {
  const detected = placeholders.map((placeholder) => placeholder.name).sort();
  const mapped = Object.keys(template.mappings).sort();
  if (JSON.stringify(detected) !== JSON.stringify(mapped)) {
    throw new Error(
      `Bundled template ${template.templateType} mappings do not match detected placeholders. ` +
      `Detected: ${detected.join(", ") || "none"}. Mapped: ${mapped.join(", ") || "none"}.`
    );
  }
}

function detectDocxPlaceholders(buffer) {
  const zip = new PizZip(buffer);
  const counts = new Map();
  for (const fileName of Object.keys(zip.files)) {
    if (!/^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(fileName)) continue;
    const xml = zip.file(fileName)?.asText() || "";
    addMatches(counts, xml, /«\s*([^»]+?)\s*»/g, "merge-field");
    addMatches(counts, xml, /\{\{\s*([^}]+?)\s*\}\}/g, "text-token");
    for (const block of xml.match(/<w:sdt[\s\S]*?<\/w:sdt>/g) || []) {
      if (!block.includes("Click or tap here to enter text.")) continue;
      const tag = block.match(/<w:tag[^>]*w:val="([^"]+)"/)?.[1];
      const alias = block.match(/<w:alias[^>]*w:val="([^"]+)"/)?.[1];
      addPlaceholder(counts, normalizePlaceholder(tag || alias || "CONTENT_CONTROL"), "content-control");
    }
  }
  return [...counts.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function addMatches(counts, xml, pattern, kind) {
  for (const match of xml.matchAll(pattern)) addPlaceholder(counts, normalizePlaceholder(match[1]), kind);
}

function addPlaceholder(counts, name, kind) {
  if (!name) return;
  const existing = counts.get(name);
  counts.set(name, { name, kind: existing?.kind || kind, occurrences: (existing?.occurrences || 0) + 1 });
}

function normalizePlaceholder(value) {
  return decodeXml(value)
    .replace(/MERGEFIELD/gi, "")
    .replace(/\\\* MERGEFORMAT/gi, "")
    .replace(/[^a-zA-Z0-9_ ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
