import PizZip from "pizzip";
import { normalizePlaceholder } from "@/lib/docx-placeholders";

const xmlFilePattern = /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/;

export function generateDocxFromTemplate(template: Buffer, values: Record<string, string>) {
  const zip = new PizZip(template);
  for (const fileName of Object.keys(zip.files)) {
    if (!xmlFilePattern.test(fileName)) continue;
    const file = zip.file(fileName);
    if (!file) continue;
    const updated = replacePlaceholders(file.asText(), values);
    zip.file(fileName, updated);
  }

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

function replacePlaceholders(xml: string, values: Record<string, string>) {
  let output = xml;

  for (const [key, value] of Object.entries(values)) {
    const escaped = escapeXml(value);
    output = output.replace(new RegExp(`«\\s*${escapeRegExp(key)}\\s*»`, "g"), escaped);
    output = output.replace(new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, "g"), escaped);
  }

  output = output.replace(/«\s*([^»]+?)\s*»/g, (_match, raw) => escapeXml(values[normalizePlaceholder(raw)] ?? ""));
  output = output.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, raw) => escapeXml(values[normalizePlaceholder(raw)] ?? ""));

  return output.replace(
    /(<w:sdt[\s\S]*?<w:sdtContent>)([\s\S]*?Click or tap here to enter text\.[\s\S]*?)(<\/w:sdtContent>[\s\S]*?<\/w:sdt>)/g,
    (match) => {
      const tag = match.match(/<w:tag[^>]*w:val="([^"]+)"/)?.[1];
      const alias = match.match(/<w:alias[^>]*w:val="([^"]+)"/)?.[1];
      const key = normalizePlaceholder(tag ?? alias ?? "");
      const value = values[key];
      if (value == null) return match;
      return match.replace("Click or tap here to enter text.", escapeXml(value));
    }
  );
}

function escapeXml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
