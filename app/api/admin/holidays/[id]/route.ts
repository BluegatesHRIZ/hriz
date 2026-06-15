import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminHolidays");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json() as {
      hol_date: string;
      hol_name: string;
      hol_type: string;
      hol_location?: string;
      hol_repeat?: string;
      hol_status?: number;
    };

    const updated = await prisma.holiday.update({
      where: { hol_id: id },
      data: {
        hol_date: new Date(body.hol_date),
        hol_name: body.hol_name,
        hol_type: body.hol_type,
        hol_location: body.hol_location ?? null,
        hol_repeat: body.hol_repeat ?? "Yearly",
        hol_status: body.hol_status ?? 1,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Admin holidays PUT error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminHolidays");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    await prisma.holiday.delete({ where: { hol_id: id } });

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Admin holidays DELETE error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
