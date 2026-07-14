import { HttpError } from "@/lib/auth";

const templateNamePattern = /^[^\u0000-\u001F\u007F]{1,160}$/;

export function parseTemplateName(value: string) {
  const name = value.trim();
  if (!templateNamePattern.test(name)) {
    throw new HttpError(400, "Template name must be 160 characters or fewer and cannot contain control characters.");
  }
  return name;
}
