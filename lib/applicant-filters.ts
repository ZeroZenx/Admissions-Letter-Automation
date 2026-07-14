import { HttpError } from "@/lib/auth";
import { parseTemplateType } from "@/lib/template-types";

const applicantFilterColumns = {
  templateType: "template_type",
  admissionStatus: "admission_status",
  emailStatus: "email_status",
  campus: "campus",
  program: "program"
} as const;

const applicantEmailStatuses = ["Not Sent", "Queued", "Sending", "Sent", "Failed"] as const;
const freeTextFilterPattern = /^[^\u0000-\u001F\u007F]{1,200}$/;

export type ApplicantFilterKey = keyof typeof applicantFilterColumns;

export function readApplicantFilters(url: URL) {
  const filters: Partial<Record<ApplicantFilterKey, string>> = {};

  for (const key of Object.keys(applicantFilterColumns) as ApplicantFilterKey[]) {
    const value = url.searchParams.get(key)?.trim();
    if (!value) continue;
    filters[key] = validateApplicantFilter(key, value);
  }

  return filters;
}

export function applicantFilterClauses(filters: Partial<Record<ApplicantFilterKey, string>>, params: unknown[]) {
  const clauses: string[] = [];

  for (const [key, column] of Object.entries(applicantFilterColumns) as Array<[ApplicantFilterKey, string]>) {
    const value = filters[key];
    if (!value) continue;
    params.push(value);
    clauses.push(`${column} = $${params.length}`);
  }

  return clauses;
}

function validateApplicantFilter(key: ApplicantFilterKey, value: string) {
  if (key === "templateType") return parseTemplateType(value);
  if (key === "emailStatus") {
    if (!applicantEmailStatuses.includes(value as (typeof applicantEmailStatuses)[number])) {
      throw new HttpError(400, "emailStatus must be one of Not Sent, Queued, Sending, Sent, or Failed.");
    }
    return value;
  }
  if (!freeTextFilterPattern.test(value)) {
    throw new HttpError(400, `${key} must be 200 characters or fewer and cannot contain control characters.`);
  }
  return value;
}
