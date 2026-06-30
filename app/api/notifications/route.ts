import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";
import { parsePagination, paginate } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    let payload: { name?: string };
    try {
      payload = await verifyToken(authHeader.substring(7)) as { name?: string };
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const empId = payload.name ?? "";
    const { page, limit, skip, take } = parsePagination(request.nextUrl.searchParams);

    const where = { not_emp: empId };
    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { not_logdate: "desc" },
        skip,
        take,
      }),
    ]);

    return NextResponse.json(paginate(notifications, total, page, limit));
  } catch (error) {
    console.error("Notifications GET error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    let payload: { name?: string };
    try {
      payload = await verifyToken(authHeader.substring(7)) as { name?: string };
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const body = await request.json() as { not_emp: string; not_title: string; not_desc: string };
    if (!body.not_emp || !body.not_title || !body.not_desc) {
      return NextResponse.json({ message: "not_emp, not_title, not_desc required" }, { status: 400 });
    }

    const created = await prisma.notification.create({
      data: {
        not_emp: body.not_emp,
        not_title: body.not_title.substring(0, 45),
        not_desc: body.not_desc.substring(0, 150),
        not_status: 0,
        not_createdby: payload.name ?? "",
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Notifications POST error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
