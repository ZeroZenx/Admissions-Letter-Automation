import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { HttpError, requireAuth } from "@/lib/auth";
import { generateDocxFromTemplate } from "@/lib/docx-generate";
import { letterDownloadFileName } from "@/lib/download-filenames";
import { buildLetterValues } from "@/lib/letter-values";
import { convertDocxToPdf } from "@/lib/pdf-converter";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { readStorageBuffer, saveBuffer, storageFileExists } from "@/lib/storage";
import { enforceApplicantOwnership, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const applicantSelect = `
  SELECT id, counselor_user_id, student_id, term, first_name, middle_name, last_name,
         address_code, address1, address2, address3, city, country, nation, campus,
         college, degree, major, status, program, date_generated, birth_date,
         id_passport, residency_code, residency_description, application_source,
         spriden_user, email, email_code, phone1, phone2, admission_status,
         email_status, sent_date, word_file_name, pdf_file_name, error_message,
         processed_by_flow, template_type, raw_data, validation_errors
    FROM applicants
   WHERE id = $1`;

type ApplicantGenerationRow = {
  id: string;
  counselor_user_id: string | null;
  student_id: string;
  template_type: string;
  validation_errors: unknown;
  raw_data: unknown;
  [key: string]: unknown;
};

type TemplateGenerationRow = {
  id: string;
  template_type: string;
  storage_key: string;
  placeholders: unknown;
};

const schema = z.object({
  applicantId: z.string().uuid(),
  convertPdf: z.boolean().default(true)
});

export async function POST(request: Request) {
  let dbUserId: string | undefined;
  let applicantId: string | undefined;
  let letterId: string | undefined;
  let failureStudentId: unknown;
  let failureTemplateType: unknown;
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor", "Counselor"]);
    const dbUser = await ensureDbUser(user);
    dbUserId = dbUser.id;
    const body = schema.parse(await request.json());
    applicantId = body.applicantId;
    const applicantResult = await query<ApplicantGenerationRow>(applicantSelect, [body.applicantId]);
    const applicant = applicantResult.rows[0];
    if (!applicant) return NextResponse.json({ error: "Applicant not found." }, { status: 404 });
    failureStudentId = applicant.student_id;
    failureTemplateType = applicant.template_type;
    enforceApplicantOwnership(user, dbUser.id, applicant);
    if (hasValidationErrors(applicant.validation_errors)) {
      throw new HttpError(400, `Applicant ${String(applicant.student_id ?? "")} has source-truth validation errors. Correct the Banner row before generating a letter.`);
    }

    const templateResult = await query<TemplateGenerationRow>(
      `SELECT id, template_type, storage_key, placeholders
         FROM templates
        WHERE template_type = $1 AND is_active = true`,
      [applicant.template_type]
    );
    const template = templateResult.rows[0];
    if (!template) {
      throw new HttpError(400, `No active template for ${applicant.template_type}.`);
    }

    const mappings = await query<{ placeholder: string; banner_field: string; fallback_value: string | null }>(
      "SELECT placeholder, banner_field, fallback_value FROM field_mappings WHERE template_id = $1",
      [template.id]
    );
    const missingMappings = missingTemplateMappings(template.placeholders, mappings.rows);
    if (missingMappings.length) {
      throw new HttpError(400, `Template ${String(applicant.template_type)} has unmapped placeholders: ${missingMappings.join(", ")}.`);
    }

    if (!(await storageFileExists(String(template.storage_key)))) {
      throw new HttpError(400, `Template file for ${String(applicant.template_type)} was not found in storage. Re-upload and activate the template before generating letters.`);
    }

    const templateBuffer = await readStorageBuffer(String(template.storage_key));
    const values = buildLetterValues(applicant, mappings.rows);
    const docx = generateDocxFromTemplate(templateBuffer, values);
    const fileBase = letterDownloadFileName(String(applicant.student_id), String(applicant.template_type), "docx");
    const docxStorageKey = await saveBuffer("generated", fileBase, docx);

    const letterResult = await query<{ id: string }>(
      `INSERT INTO generated_letters (applicant_id, template_id, docx_storage_key, status, generated_by)
       VALUES ($1, $2, $3, 'docx_generated', $4)
       RETURNING id`,
      [body.applicantId, template.id, docxStorageKey, dbUser.id]
    );
    letterId = letterResult.rows[0].id;
    await query("UPDATE applicants SET word_file_name = $1 WHERE id = $2", [fileBase, body.applicantId]);

    let pdfStorageKey: string | null = null;
    let pdfFileName: string | null = null;
    if (body.convertPdf) {
      pdfStorageKey = await convertDocxToPdf(docxStorageKey);
      pdfFileName = fileBase.replace(/\.docx$/i, ".pdf");
      await query("UPDATE generated_letters SET pdf_storage_key = $1, status = 'pdf_generated' WHERE id = $2", [
        pdfStorageKey,
        letterId
      ]);
    }
    await query(
      `UPDATE applicants
          SET word_file_name = $1,
              pdf_file_name = COALESCE($2, pdf_file_name),
              error_message = null,
              processed_by_flow = true
        WHERE id = $3`,
      [fileBase, pdfFileName, body.applicantId]
    );

    await audit("letter.generated", "generated_letters", {
      studentId: applicant.student_id,
      templateType: applicant.template_type,
      wordFileName: fileBase,
      pdfFileName,
      generatedDocx: true,
      generatedPdf: Boolean(pdfStorageKey)
    }, letterResult.rows[0].id, dbUser.id);

    return NextResponse.json({
      generatedLetterId: letterId,
      docxReady: true,
      pdfReady: Boolean(pdfStorageKey)
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown letter generation failure";
    if (applicantId) {
      await query("UPDATE applicants SET error_message = $1, processed_by_flow = false WHERE id = $2", [errorMessage, applicantId]).catch(() => undefined);
    }
    if (letterId) {
      await query("UPDATE generated_letters SET status = 'failed', error_message = $1 WHERE id = $2", [errorMessage, letterId]).catch(() => undefined);
      await audit("letter.failed", "generated_letters", {
        studentId: failureStudentId,
        templateType: failureTemplateType,
        error: errorMessage
      }, letterId, dbUserId).catch(() => undefined);
    } else if (applicantId) {
      await audit("letter.failed", "applicants", {
        studentId: failureStudentId,
        templateType: failureTemplateType,
        error: errorMessage
      }, applicantId, dbUserId).catch(() => undefined);
    }
    return handleApiError(error);
  }
}

function missingTemplateMappings(
  placeholders: unknown,
  mappings: Array<{ placeholder: string }>
) {
  const mapped = new Set(mappings.map((mapping) => mapping.placeholder));
  const placeholderNames = Array.isArray(placeholders)
    ? placeholders
        .map((placeholder) => (placeholder && typeof placeholder === "object" && "name" in placeholder ? placeholder.name : undefined))
        .filter((name): name is string => typeof name === "string" && name.length > 0)
    : [];
  return placeholderNames.filter((name) => !mapped.has(name));
}

function hasValidationErrors(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}
