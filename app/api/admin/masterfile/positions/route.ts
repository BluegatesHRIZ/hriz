import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminMasterfile");
    if (!auth.ok) return auth.response;

    const list = await prisma.position.findMany({ orderBy: { pst_id: "asc" } });
    return NextResponse.json(list);
  } catch (error) {
    console.error("Masterfile positions GET error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminMasterfile");
    if (!auth.ok) return auth.response;

    const body = await request.json() as { pst_id: string; pst_desc: string; pst_Status: number };

    if (!body.pst_id?.trim() || !body.pst_desc?.trim()) {
      return NextResponse.json({ message: "ID and description are required." }, { status: 400 });
    }

    const created = await prisma.position.create({
      data: {
        pst_id: body.pst_id.trim().toUpperCase(),
        pst_desc: body.pst_desc.trim(),
        pst_Status: body.pst_Status ?? 1,
        pst_createdby: auth.payload.name ?? null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ message: "Position ID already exists." }, { status: 409 });
    }
    console.error("Masterfile positions POST error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
