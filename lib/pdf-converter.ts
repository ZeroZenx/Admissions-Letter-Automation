import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getServerEnv } from "@/lib/env";
import { storagePath } from "@/lib/storage";

const execFileAsync = promisify(execFile);

export async function convertDocxToPdf(docxStorageKey: string) {
  const soffice = getServerEnv().SOFFICE_PATH || "soffice";
  const docxPath = storagePath(docxStorageKey);
  const outputDir = path.dirname(docxPath);
  await mkdir(outputDir, { recursive: true });

  await execFileAsync(soffice, [
    "--headless",
    "--convert-to",
    "pdf",
    "--outdir",
    outputDir,
    docxPath
  ]);

  const pdfPath = docxPath.replace(/\.docx$/i, ".pdf");
  return pdfPath.replace(`${storagePath("")}${path.sep}`, "");
}
