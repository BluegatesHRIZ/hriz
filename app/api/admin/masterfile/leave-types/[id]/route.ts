import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminMasterfile");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json() as {
      lev_desc: string; lev_days: number; lev_status: number;
      lev_before: number; lev_lead: number; lev_after: number;
    };

    const updated = await prisma.leave.update({
      where: { lev_id: id },
      data: {
        lev_desc: body.lev_desc,
        lev_days: body.lev_days,
        lev_status: body.lev_status,
        lev_before: body.lev_before,
        lev_lead: body.lev_lead,
        lev_after: body.lev_after,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Leave-types PUT error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminMasterfile");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    await prisma.leave.delete({ where: { lev_id: id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Leave-types DELETE error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
