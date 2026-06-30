import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Microsoft Graph sendMail is planned for milestone 2. This route is present so the UI and audit contract are stable."
    },
    { status: 501 }
  );
}
