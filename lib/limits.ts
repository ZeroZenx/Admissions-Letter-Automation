export const uploadLimits = {
  excelBytes: 10 * 1024 * 1024,
  docxBytes: 15 * 1024 * 1024,
  pdfAttachmentBytes: 10 * 1024 * 1024,
  bulkApplicantIds: 2000,
  zipGeneratedLetterIds: 200,
  statusExportRows: 10000
};

export const listLimits = {
  applicants: 500,
  auditLogs: 500,
  emailLogs: 500,
  generatedLetters: 200,
  imports: 100,
  maxOffset: 10000
};
