import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import * as requestProcedures from "@/lib/services/requests.service";
import { prisma } from "@/lib/db/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const resolvedParams = await params;
    const otId = resolvedParams.id;
    const body = await request.json();

    if (otId !== body.otm_id?.toString()) {
      return NextResponse.json({ message: "ID mismatch" }, { status: 400 });
    }

    const {
      otm_id,
      otm_emp,
      otm_type,
      otm_date,
      otm_from,
      otm_to,
      otm_reason,
    } = body;

    // Get settings for validation
    const settings = await prisma.settings_tab.findFirst();

    // TODO: Implement RequestLimit.BeforeAfter validation

    // Update overtime request
    await requestProcedures.otUpdateOtRequest(
      otId,
      otm_type,
      new Date(otm_date),
      new Date(otm_from),
      new Date(otm_to),
      otm_reason || ""
    );

    return NextResponse.json(body);
  } catch (error) {
    console.error("Update overtime error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
