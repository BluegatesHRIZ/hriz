import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminMasterfile");
    if (!auth.ok) return auth.response;

    const body = await request.json() as { pst_desc: string; pst_Status: number };

    const updated = await prisma.position.update({
      where: { pst_id: params.id },
      data: { pst_desc: body.pst_desc, pst_Status: body.pst_Status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Positions PUT error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminMasterfile");
    if (!auth.ok) return auth.response;

    await prisma.position.delete({ where: { pst_id: params.id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Positions DELETE error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
