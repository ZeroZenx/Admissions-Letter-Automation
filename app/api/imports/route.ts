import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleApiError } from "@/lib/http";
import { listLimits, readPaginationParams } from "@/lib/request-limits";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const archived = url.searchParams.get("archived") === "true";
    await requireAuth(request, archived ? ["Admin", "Admissions Supervisor"] : undefined);
    const page = readPaginationParams(url, { defaultLimit: listLimits.imports, maxLimit: listLimits.imports });
    const result = await query(
      `SELECT i.id, i.uploaded_file_name, i.worksheet_name, i.imported_at,
              i.total_rows, i.valid_rows, i.invalid_rows, i.status, i.errors, i.archived_at,
              u.display_name AS imported_by_name, u.email AS imported_by_email
         FROM imports i
         LEFT JOIN users u ON u.id = i.imported_by
        WHERE ${archived ? "i.archived_at IS NOT NULL" : "i.archived_at IS NULL"}
        ORDER BY i.imported_at DESC
        LIMIT $1 OFFSET $2`,
      [page.limit, page.offset]
    );

    return NextResponse.json({ imports: result.rows, page });
  } catch (error) {
    return handleApiError(error);
  }
}
