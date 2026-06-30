import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { generateDocxFromTemplate } from "@/lib/docx-generate";
import { buildLetterValues } from "@/lib/letter-values";
import { convertDocxToPdf } from "@/lib/pdf-converter";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { readStorageBuffer, saveBuffer } from "@/lib/storage";
import { enforceApplicantOwnership, ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

const schema = z.object({
  applicantId: z.string().uuid(),
  convertPdf: z.boolean().default(true)
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor", "Counselor"]);
    const dbUser = await ensureDbUser(user);
    const body = schema.parse(await request.json());
    const applicantResult = await query<Record<string, unknown>>("SELECT * FROM applicants WHERE id = $1", [body.applicantId]);
    const applicant = applicantResult.rows[0];
    if (!applicant) return NextResponse.json({ error: "Applicant not found." }, { status: 404 });
    enforceApplicantOwnership(user, dbUser.id, applicant);

    const templateResult = await query<Record<string, unknown>>(
      "SELECT * FROM templates WHERE template_type = $1 AND is_active = true",
      [applicant.template_type]
    );
    const template = templateResult.rows[0];
    if (!template) {
      return NextResponse.json({ error: `No active template for ${applicant.template_type}.` }, { status: 400 });
    }

    const mappings = await query<{ placeholder: string; banner_field: string; fallback_value: string | null }>(
      "SELECT placeholder, banner_field, fallback_value FROM field_mappings WHERE template_id = $1",
      [template.id]
    );

    const templateBuffer = await readStorageBuffer(String(template.storage_key));
    const values = buildLetterValues(applicant, mappings.rows);
    const docx = generateDocxFromTemplate(templateBuffer, values);
    const fileBase = `${applicant.student_id}-${applicant.template_type}.docx`;
    const docxStorageKey = await saveBuffer("generated", fileBase, docx);

    const letterResult = await query<{ id: string }>(
      `INSERT INTO generated_letters (applicant_id, template_id, docx_storage_key, status, generated_by)
       VALUES ($1, $2, $3, 'docx_generated', $4)
       RETURNING id`,
      [body.applicantId, template.id, docxStorageKey, dbUser.id]
    );

    let pdfStorageKey: string | null = null;
    if (body.convertPdf) {
      pdfStorageKey = await convertDocxToPdf(docxStorageKey);
      await query("UPDATE generated_letters SET pdf_storage_key = $1, status = 'pdf_generated' WHERE id = $2", [
        pdfStorageKey,
        letterResult.rows[0].id
      ]);
    }

    await audit("letter.generated", "generated_letters", {
      studentId: applicant.student_id,
      templateType: applicant.template_type,
      generatedDocx: true,
      generatedPdf: Boolean(pdfStorageKey)
    }, letterResult.rows[0].id, dbUser.id);

    return NextResponse.json({
      generatedLetterId: letterResult.rows[0].id,
      docxReady: true,
      pdfReady: Boolean(pdfStorageKey)
    });
  } catch (error) {
    return handleApiError(error);
  }
}
