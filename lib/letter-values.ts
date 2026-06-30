import { bannerFields } from "@/lib/banner-fields";
import { normalizePlaceholder } from "@/lib/docx-placeholders";

export function buildLetterValues(
  applicant: Record<string, unknown>,
  mappings: Array<{ placeholder: string; banner_field: string; fallback_value: string | null }>
) {
  const values: Record<string, string> = {};
  const raw = (applicant.raw_data ?? {}) as Record<string, unknown>;

  for (const field of bannerFields) {
    values[field] = stringify(raw[field] ?? applicant[toSnake(field)]);
    values[normalizePlaceholder(field)] = values[field];
  }

  values.FullName = [raw.FirstName, raw.MiddleName, raw.LastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  values.Today = new Date().toLocaleDateString("en-TT", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  for (const mapping of mappings) {
    const rawValue = raw[mapping.banner_field] ?? applicant[toSnake(mapping.banner_field)];
    values[normalizePlaceholder(mapping.placeholder)] = stringify(rawValue || mapping.fallback_value || "");
  }

  return values;
}

function stringify(value: unknown) {
  return value == null ? "" : String(value);
}

function toSnake(value: string) {
  return value.replace(/[A-Z]/g, (letter, index) => `${index ? "_" : ""}${letter.toLowerCase()}`);
}
