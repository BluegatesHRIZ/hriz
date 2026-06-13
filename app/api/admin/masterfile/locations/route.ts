import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminMasterfile");
    if (!auth.ok) return auth.response;

    const list = await prisma.location.findMany({ orderBy: { loc_id: "asc" } });
    return NextResponse.json(list);
  } catch (error) {
    console.error("Masterfile locations GET error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminMasterfile");
    if (!auth.ok) return auth.response;

    const body = await request.json() as { loc_id: string; loc_desc: string; loc_code: string; loc_status: number };

    if (!body.loc_id?.trim() || !body.loc_desc?.trim()) {
      return NextResponse.json({ message: "ID and description are required." }, { status: 400 });
    }

    const created = await prisma.location.create({
      data: {
        loc_id: body.loc_id.trim().toUpperCase(),
        loc_desc: body.loc_desc.trim(),
        loc_code: body.loc_code?.trim() ?? null,
        loc_status: body.loc_status ?? 1,
        loc_createdby: auth.payload.name ?? null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ message: "Location ID already exists." }, { status: 409 });
    }
    console.error("Masterfile locations POST error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
