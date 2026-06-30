import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { withTransaction } from "@/lib/db";
import { readAdmissionsWorksheet, rowToApplicantColumns, validateBannerRow } from "@/lib/import-excel";
import { saveBuffer } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload an Excel file using the file field." }, { status: 400 });
  }

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
      `INSERT INTO imports (uploaded_file_name, worksheet_name, total_rows, valid_rows, invalid_rows, errors)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [file.name, workbook.worksheetName, workbook.rows.length, workbook.rows.length - invalidRows.length, invalidRows.length, invalidRows]
    );

    const importId = importResult.rows[0].id;
    for (const row of workbook.rows) {
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

  await audit("import.created", "imports", {
    uploadedFileName: file.name,
    worksheetName: workbook.worksheetName,
    totalRows: workbook.rows.length,
    invalidRows: invalidRows.length
  }, importRecord.id);

  return NextResponse.json({
    importId: importRecord.id,
    totalRows: workbook.rows.length,
    validRows: workbook.rows.length - invalidRows.length,
    invalidRows: invalidRows.length,
    errors: invalidRows
  });
}
