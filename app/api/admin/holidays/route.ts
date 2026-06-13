import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";

/**
 * GET /api/admin/holidays
 * List all holidays. Requires AccessHoliday.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminHolidays");
    if (!auth.ok) return auth.response;

    const list = await prisma.holiday.findMany({
      orderBy: { hol_date: "desc" },
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("Admin holidays GET error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/holidays
 * Create a holiday. Requires CreateHoliday.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminHolidays");
    if (!auth.ok) return auth.response;

    const body = await request.json() as {
      hol_date: string;
      hol_name: string;
      hol_type: string;
      hol_location?: string;
      hol_repeat?: string;
      hol_status?: number;
    };

    // Generate ID: HOL + timestamp
    const hol_id = `HOL${Date.now()}`;

    const created = await prisma.holiday.create({
      data: {
        hol_id,
        hol_date: new Date(body.hol_date),
        hol_name: body.hol_name,
        hol_type: body.hol_type,
        hol_location: body.hol_location ?? null,
        hol_repeat: body.hol_repeat ?? "Yearly",
        hol_status: body.hol_status ?? 1,
        hol_logdate: new Date(),
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Admin holidays POST error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
