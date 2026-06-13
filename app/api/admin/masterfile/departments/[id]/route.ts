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

    const body = await request.json() as { dep_desc: string; dep_status: number };

    const updated = await prisma.department.update({
      where: { dep_id: params.id },
      data: { dep_desc: body.dep_desc, dep_status: body.dep_status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Departments PUT error:", error);
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

    await prisma.department.delete({ where: { dep_id: params.id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Departments DELETE error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
