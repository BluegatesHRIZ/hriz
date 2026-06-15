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
    const body = await request.json() as { loc_desc: string; loc_code: string; loc_status: number };

    const updated = await prisma.location.update({
      where: { loc_id: id },
      data: { loc_desc: body.loc_desc, loc_code: body.loc_code, loc_status: body.loc_status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Locations PUT error:", error);
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
    await prisma.location.delete({ where: { loc_id: id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Locations DELETE error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
