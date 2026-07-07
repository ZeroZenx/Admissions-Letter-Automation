import { NextResponse } from "next/server";
import { HttpError } from "@/lib/auth";

export const uploadLimits = {
  excelBytes: 10 * 1024 * 1024,
  docxBytes: 15 * 1024 * 1024,
  pdfAttachmentBytes: 10 * 1024 * 1024,
  bulkApplicantIds: 2000,
  zipGeneratedLetterIds: 200
};

export const listLimits = {
  applicants: 500,
  auditLogs: 500,
  emailLogs: 500,
  generatedLetters: 200,
  imports: 100,
  maxOffset: 10000
};

export function validateFileSize(file: File, maxBytes: number, label: string) {
  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        error: `${label} exceeds the ${formatBytes(maxBytes)} upload limit.`
      },
      { status: 413 }
    );
  }
  return null;
}

export function readPaginationParams(
  url: URL,
  options: { defaultLimit: number; maxLimit: number; maxOffset?: number }
) {
  const maxOffset = options.maxOffset ?? listLimits.maxOffset;
  return {
    limit: readBoundedWholeNumber(url.searchParams.get("limit"), "limit", 1, options.maxLimit, options.defaultLimit),
    offset: readBoundedWholeNumber(url.searchParams.get("offset"), "offset", 0, maxOffset, 0)
  };
}

export function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb % 1 === 0 ? 0 : 1)} MB`;
}

function readBoundedWholeNumber(value: string | null, name: string, min: number, max: number, fallback: number) {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw new HttpError(400, `${name} must be a whole number between ${min} and ${max}.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `${name} must be a whole number between ${min} and ${max}.`);
  }
  return parsed;
}
