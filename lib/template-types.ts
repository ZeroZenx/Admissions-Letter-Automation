import { HttpError } from "@/lib/auth";

const templateTypePattern = /^[A-Z0-9_-]{1,80}$/;

export function normalizeTemplateType(value: string) {
  return value.trim().toUpperCase();
}

export function parseTemplateType(value: string) {
  const normalized = normalizeTemplateType(value);
  if (!isTemplateTypeCode(normalized)) {
    throw new HttpError(
      400,
      "templateType must contain only letters, numbers, underscores, or hyphens, and be 80 characters or fewer."
    );
  }
  return normalized;
}

export function isTemplateTypeCode(value: string) {
  return templateTypePattern.test(value);
}
