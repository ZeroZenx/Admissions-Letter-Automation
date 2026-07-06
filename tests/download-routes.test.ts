import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("download ZIP route rejects partial archives and audits bulk downloads", async () => {
  const source = await readFile("app/api/download-zip/route.ts", "utf8");

  assert.match(source, /generatedLetterIds: z\.array\(z\.string\(\)\.uuid\(\)\)\.min\(1\)/);
  assert.match(source, /requireAuth\(request, \["Admin", "Admissions Supervisor", "Counselor"\]\)/);
  assert.match(source, /One or more generated letters were not found/);
  assert.match(source, /enforceApplicantOwnership/);
  assert.match(source, /letters\.downloaded_zip/);
  assert.match(source, /fileCount: result\.rows\.length/);
  assert.match(source, /uniqueZipEntryName/);
  assert.match(source, /a\.template_type/);
});

test("individual download route audits downloads without returning storage paths", async () => {
  const source = await readFile("app/api/download/[id]/route.ts", "utf8");

  assert.match(source, /requireAuth\(request, \["Admin", "Admissions Supervisor", "Counselor"\]\)/);
  assert.match(source, /readStorageBuffer\(key\)/);
  assert.match(source, /letter\.downloaded/);
  assert.match(source, /fileType: type/);
  assert.match(source, /disposition = url\.searchParams\.get\("disposition"\) === "inline" \? "inline" : "attachment"/);
  assert.match(source, /letterDownloadFileName\(result\.rows\[0\]\.student_id, result\.rows\[0\]\.template_type, type\)/);
  assert.match(source, /return new NextResponse\(buffer/);
  assert.doesNotMatch(source, /NextResponse\.json\([^)]*storage_key/s);
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
  assert.match(source, /const quotedMatch = disposition\.match/);
  assert.match(source, /const plainMatch = disposition\.match/);
  assert.match(source, /anchor\.download = responseDownloadFileName\(response, `\$\{letterId\}\.\$\{type\}`\)/);
});
