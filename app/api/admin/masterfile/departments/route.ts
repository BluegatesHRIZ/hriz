import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminMasterfile");
    if (!auth.ok) return auth.response;

    const list = await prisma.department.findMany({ orderBy: { dep_id: "asc" } });
    return NextResponse.json(list);
  } catch (error) {
    console.error("Masterfile departments GET error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminMasterfile");
    if (!auth.ok) return auth.response;

    const body = await request.json() as { dep_id: string; dep_desc: string; dep_status: number };

    if (!body.dep_id?.trim() || !body.dep_desc?.trim()) {
      return NextResponse.json({ message: "ID and description are required." }, { status: 400 });
    }

    const created = await prisma.department.create({
      data: {
        dep_id: body.dep_id.trim().toUpperCase(),
        dep_desc: body.dep_desc.trim(),
        dep_status: body.dep_status ?? 1,
        dep_createdby: auth.payload.name ?? null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ message: "Department ID already exists." }, { status: 409 });
    }
    console.error("Masterfile departments POST error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
