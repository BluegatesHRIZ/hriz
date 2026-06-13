import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminMasterfile");
    if (!auth.ok) return auth.response;

    const list = await prisma.leave.findMany({ orderBy: { lev_id: "asc" } });
    return NextResponse.json(list);
  } catch (error) {
    console.error("Masterfile leave-types GET error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminMasterfile");
    if (!auth.ok) return auth.response;

    const body = await request.json() as {
      lev_id: string; lev_desc: string; lev_days: number;
      lev_status: number; lev_before: number; lev_lead: number; lev_after: number;
    };

    if (!body.lev_id?.trim() || !body.lev_desc?.trim()) {
      return NextResponse.json({ message: "ID and description are required." }, { status: 400 });
    }

    const created = await prisma.leave.create({
      data: {
        lev_id: body.lev_id.trim().toUpperCase(),
        lev_desc: body.lev_desc.trim(),
        lev_days: body.lev_days ?? 0,
        lev_status: body.lev_status ?? 1,
        lev_before: body.lev_before ?? 0,
        lev_lead: body.lev_lead ?? 0,
        lev_after: body.lev_after ?? 0,
        lev_createdby: auth.payload.name ?? null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ message: "Leave type ID already exists." }, { status: 409 });
    }
    console.error("Masterfile leave-types POST error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
