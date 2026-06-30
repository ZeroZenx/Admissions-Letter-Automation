import PizZip from "pizzip";

export type DetectedPlaceholder = {
  name: string;
  kind: "merge-field" | "text-token" | "content-control";
  occurrences: number;
};

const xmlFilePattern = /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/;

export function detectDocxPlaceholders(buffer: Buffer): DetectedPlaceholder[] {
  const zip = new PizZip(buffer);
  const counts = new Map<string, DetectedPlaceholder>();

  for (const fileName of Object.keys(zip.files)) {
    if (!xmlFilePattern.test(fileName)) continue;
    const xml = zip.file(fileName)?.asText() ?? "";
    addMatches(counts, xml, /«\s*([^»]+?)\s*»/g, "merge-field");
    addMatches(counts, xml, /\{\{\s*([^}]+?)\s*\}\}/g, "text-token");
    addContentControls(counts, xml);
  }

  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function addMatches(
  counts: Map<string, DetectedPlaceholder>,
  xml: string,
  pattern: RegExp,
  kind: DetectedPlaceholder["kind"]
) {
  for (const match of xml.matchAll(pattern)) {
    const name = normalizePlaceholder(match[1]);
    if (!name) continue;
    const existing = counts.get(name);
    counts.set(name, {
      name,
      kind: existing?.kind ?? kind,
      occurrences: (existing?.occurrences ?? 0) + 1
    });
  }
}

function addContentControls(counts: Map<string, DetectedPlaceholder>, xml: string) {
  const blocks = xml.match(/<w:sdt[\s\S]*?<\/w:sdt>/g) ?? [];
  for (const block of blocks) {
    if (!block.includes("Click or tap here to enter text.")) continue;
    const tag = block.match(/<w:tag[^>]*w:val="([^"]+)"/)?.[1];
    const alias = block.match(/<w:alias[^>]*w:val="([^"]+)"/)?.[1];
    const name = normalizePlaceholder(tag ?? alias ?? "CONTENT_CONTROL");
    const existing = counts.get(name);
    counts.set(name, {
      name,
      kind: "content-control",
      occurrences: (existing?.occurrences ?? 0) + 1
    });
  }
}

export function normalizePlaceholder(value: string) {
  return decodeXml(value)
    .replace(/MERGEFIELD/gi, "")
    .replace(/\\\* MERGEFORMAT/gi, "")
    .replace(/[^a-zA-Z0-9_ ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
