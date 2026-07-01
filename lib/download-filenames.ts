export function letterDownloadFileName(studentId: string, templateType: string, extension: "docx" | "pdf") {
  return `${safeFileNamePart(studentId)}-${safeFileNamePart(templateType)}.${extension}`;
}

export function uniqueZipEntryName(
  usedNames: Set<string>,
  studentId: string,
  templateType: string,
  extension: "docx" | "pdf"
) {
  const baseName = letterDownloadFileName(studentId, templateType, extension);
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }

  const stem = baseName.replace(new RegExp(`\\.${extension}$`), "");
  let counter = 2;
  let candidate = `${stem}-${counter}.${extension}`;
  while (usedNames.has(candidate)) {
    counter += 1;
    candidate = `${stem}-${counter}.${extension}`;
  }
  usedNames.add(candidate);
  return candidate;
}

function safeFileNamePart(value: string) {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || "letter";
}
