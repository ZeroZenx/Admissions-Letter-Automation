import { NextResponse } from "next/server";

export const uploadLimits = {
  excelBytes: 10 * 1024 * 1024,
  docxBytes: 15 * 1024 * 1024,
  pdfAttachmentBytes: 10 * 1024 * 1024,
  bulkApplicantIds: 2000,
  zipGeneratedLetterIds: 200
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

export function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb % 1 === 0 ? 0 : 1)} MB`;
}
