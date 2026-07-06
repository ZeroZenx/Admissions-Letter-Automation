import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { readAdmissionsWorksheet, rowToApplicantColumns, validateBannerRow } from "@/lib/import-excel";
import { uploadLimits, validateFileSize } from "@/lib/request-limits";
import { saveBuffer } from "@/lib/storage";
import { ensureDbUser } from "@/lib/user-context";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request, ["Admin", "Admissions Supervisor", "Counselor"]);
    const dbUser = await ensureDbUser(user);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload an Excel file using the file field." }, { status: 400 });
    }
    if (!/\.xlsx$/i.test(file.name)) {
      return NextResponse.json({ error: "Only .xlsx Excel workbook uploads are allowed." }, { status: 400 });
    }
    const sizeError = validateFileSize(file, uploadLimits.excelBytes, "Banner export");
    if (sizeError) return sizeError;

    const buffer = Buffer.from(await file.arrayBuffer());
    await saveBuffer("imports", file.name, buffer);
    const workbook = await readAdmissionsWorksheet(buffer);
    const rowErrors = workbook.rows.map((row, index) => ({
      rowNumber: index + 2,
      studentId: row.StudentID,
      errors: validateBannerRow(row)
    }));
    const invalidRows = rowErrors.filter((row) => row.errors.length > 0);

    const importRecord = await withTransaction(async (client) => {
      const importResult = await client.query<{ id: string }>(
        `INSERT INTO imports (uploaded_file_name, worksheet_name, total_rows, valid_rows, invalid_rows, status, errors)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          file.name,
          workbook.worksheetName,
          workbook.rows.length,
          workbook.rows.length - invalidRows.length,
          invalidRows.length,
          invalidRows.length ? "review" : "imported",
          invalidRows
        ]
      );

      const importId = importResult.rows[0].id;
      for (const row of workbook.rows) {
        if (validateBannerRow(row).length) continue;
        const { columns, values } = rowToApplicantColumns(row, importId);
        const placeholders = values.map((_value, index) => `$${index + 1}`).join(", ");
        await client.query(
          `INSERT INTO applicants (${columns.join(", ")})
           VALUES (${placeholders})
           ON CONFLICT (import_id, student_id, template_type) DO NOTHING`,
          values
        );
      }

      return { id: importId };
    });

    await query("UPDATE imports SET imported_by = $1 WHERE id = $2", [dbUser.id, importRecord.id]);

    await audit("import.created", "imports", {
      uploadedFileName: file.name,
      worksheetName: workbook.worksheetName,
      totalRows: workbook.rows.length,
      invalidRows: invalidRows.length
    }, importRecord.id, dbUser.id);

    const validApplicants = await query<{ id: string }>(
      "SELECT id FROM applicants WHERE import_id = $1 AND validation_errors = '[]'::jsonb ORDER BY created_at",
      [importRecord.id]
    );
    const preflight = await buildAutomationPreflight(importRecord.id);

    return NextResponse.json({
      importId: importRecord.id,
      totalRows: workbook.rows.length,
      validRows: workbook.rows.length - invalidRows.length,
      invalidRows: invalidRows.length,
      validApplicantIds: validApplicants.rows.map((row) => row.id),
      preflight,
      errors: invalidRows
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function buildAutomationPreflight(importId: string) {
  const requiredTemplates = await query<{ template_type: string; applicant_count: string }>(
    `SELECT template_type, count(*) AS applicant_count
       FROM applicants
      WHERE import_id = $1 AND validation_errors = '[]'::jsonb
      GROUP BY template_type
      ORDER BY template_type`,
    [importId]
  );
  const templates = await query<{
    template_type: string;
    is_active: boolean;
    placeholders: Array<{ name?: string }>;
    mapped_placeholders: string[];
  }>(
    `SELECT t.template_type, t.is_active, t.placeholders,
            COALESCE(array_agg(fm.placeholder) FILTER (WHERE fm.id IS NOT NULL), ARRAY[]::text[]) AS mapped_placeholders
       FROM templates t
       LEFT JOIN field_mappings fm ON fm.template_id = t.id
      GROUP BY t.id
      ORDER BY t.template_type`
  );
  const templateMap = new Map(templates.rows.map((template) => [template.template_type, template]));

  return requiredTemplates.rows.map((required) => {
    const template = templateMap.get(required.template_type);
    const placeholderNames = Array.isArray(template?.placeholders)
      ? template.placeholders.map((placeholder) => placeholder.name).filter((name): name is string => Boolean(name))
      : [];
    const mapped = new Set(template?.mapped_placeholders ?? []);
    const missingPlaceholderNames = placeholderNames.filter((name) => !mapped.has(name));
    const ready = Boolean(template?.is_active) && missingPlaceholderNames.length === 0;
    return {
      templateType: required.template_type,
      applicantCount: Number(required.applicant_count),
      status: !template ? "missing_template" : !template.is_active ? "inactive_template" : missingPlaceholderNames.length ? "missing_mappings" : "ready",
      ready,
      placeholderCount: placeholderNames.length,
      mappingCount: mapped.size,
      missingMappings: missingPlaceholderNames.length,
      missingPlaceholderNames
    };
  });
}
