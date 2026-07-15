import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("download ZIP route rejects partial archives and audits bulk downloads", async () => {
  const source = await readFile("app/api/download-zip/route.ts", "utf8");

  assert.match(source, /generatedLetterIds: z\.array\(z\.string\(\)\.uuid\(\)\)\.min\(1\)\.max\(uploadLimits\.zipGeneratedLetterIds\)/);
  assert.match(source, /requireAuth\(request, \["Admin", "Admissions Supervisor", "Counselor"\]\)/);
  assert.match(source, /hasDuplicateGeneratedLetterIds\(body\.generatedLetterIds\)/);
  assert.match(source, /ZIP download generatedLetterIds must be unique\./);
  assert.match(source, /One or more generated letters were not found/);
  assert.match(source, /storageFileExists\(key\)/);
  assert.match(source, /One or more generated files were not found/);
  assert.match(source, /enforceApplicantOwnership/);
  assert.match(source, /letters\.downloaded_zip/);
  assert.match(source, /fileCount: result\.rows\.length/);
  assert.match(source, /uniqueZipEntryName/);
  assert.match(source, /a\.template_type/);

  const duplicateCheckIndex = source.indexOf("hasDuplicateGeneratedLetterIds(body.generatedLetterIds)");
  const queryIndex = source.indexOf("SELECT gl.id");
  assert.ok(duplicateCheckIndex > -1);
  assert.ok(queryIndex > duplicateCheckIndex);
});

test("download ZIP route enforces ownership before probing generated file storage", async () => {
  const source = await readFile("app/api/download-zip/route.ts", "utf8");

  const ownershipIndex = source.indexOf("enforceApplicantOwnership(user, dbUser.id, letter)");
  const missingFilesIndex = source.indexOf("const missingFiles = []");
  const storageExistsIndex = source.indexOf("storageFileExists(key)");
  const archiveIndex = source.indexOf('const archive = archiver("zip"');

  assert.ok(ownershipIndex > -1);
  assert.ok(missingFilesIndex > ownershipIndex);
  assert.ok(storageExistsIndex > ownershipIndex);
  assert.ok(archiveIndex > storageExistsIndex);
});

test("individual download route audits downloads without returning storage paths", async () => {
  const source = await readFile("app/api/download/[id]/route.ts", "utf8");

  assert.match(source, /requireAuth\(request, \["Admin", "Admissions Supervisor", "Counselor"\]\)/);
  assert.match(source, /readStorageBuffer\(key\)/);
  assert.match(source, /storageFileExists\(key\)/);
  assert.match(source, /File not found/);
  assert.match(source, /const requestedType = url\.searchParams\.get\("type"\) \?\? "pdf"/);
  assert.match(source, /requestedType !== "pdf" && requestedType !== "docx"/);
  assert.match(source, /Download type must be pdf or docx\./);
  assert.match(source, /letter\.downloaded/);
  assert.match(source, /fileType: type/);
  assert.match(source, /disposition = url\.searchParams\.get\("disposition"\) === "inline" \? "inline" : "attachment"/);
  assert.match(source, /letterDownloadFileName\(result\.rows\[0\]\.student_id, result\.rows\[0\]\.template_type, type\)/);
  assert.match(source, /return new NextResponse\(buffer/);
  assert.doesNotMatch(source, /NextResponse\.json\([^)]*storage_key/s);
});

test("individual download route rejects malformed generated-letter ids before querying PostgreSQL", async () => {
  const source = await readFile("app/api/download/[id]/route.ts", "utf8");

  assert.match(source, /const generatedLetterIdSchema = z\.string\(\)\.uuid\(\)/);
  assert.match(source, /throw new HttpError\(400, "Generated letter id must be a valid UUID\."\)/);
  const validationIndex = source.indexOf("generatedLetterIdSchema.safeParse(id)");
  const queryIndex = source.indexOf("SELECT gl.${column}");
  assert.ok(validationIndex > -1);
  assert.ok(queryIndex > validationIndex);
});

test("letter download filenames are safe and deduplicated", async () => {
  const source = await readFile("lib/download-filenames.ts", "utf8");

  assert.match(source, /letterDownloadFileName/);
  assert.match(source, /safeFileNamePart/);
  assert.match(source, /uniqueZipEntryName/);
  assert.match(source, /usedNames\.has\(candidate\)/);
});

test("generated letters table supports authenticated PDF preview", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /async function previewLetter\(letterId: string\)/);
  assert.match(source, /authenticatedFetch\(`\/api\/download\/\$\{letterId\}\?type=pdf&disposition=inline`\)/);
  assert.match(source, /<Eye size=\{16\} \/> Preview/);
  assert.match(source, /onPreview\(letter\.id\)/);
});

test("letter downloads use server-provided safe filenames", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /function responseDownloadFileName\(response: Response, fallback: string\)/);
  assert.match(source, /response\.headers\.get\("Content-Disposition"\)/);
  assert.match(source, /const encodedMatch = disposition\.match/);
  assert.match(source, /decodeURIComponent\(encodedMatch\[1\]\)/);
  assert.match(source, /catch \{\n\s+return fallback;/);
  assert.match(source, /const quotedMatch = disposition\.match/);
  assert.match(source, /const plainMatch = disposition\.match/);
  assert.match(source, /triggerBlobDownload\(blob, responseDownloadFileName\(response, `\$\{letterId\}\.\$\{type\}`\)\)/);
  assert.match(source, /function triggerBlobDownload\(blob: Blob, fileName: string\)/);
  assert.match(source, /finally \{\n\s+URL\.revokeObjectURL\(url\);/);
});

test("download actions report thrown client failures", async () => {
  const source = await readFile("components/app-client.tsx", "utf8");

  assert.match(source, /Could not download \$\{type\.toUpperCase\(\)\} file: \$\{clientErrorMessage\(error\)\}/);
  assert.match(source, /Could not preview PDF file: \$\{clientErrorMessage\(error\)\}/);
  assert.match(source, /Could not download ZIP file: \$\{clientErrorMessage\(error\)\}/);
  assert.match(source, /Could not export applicant status workbook: \$\{clientErrorMessage\(error\)\}/);
});
