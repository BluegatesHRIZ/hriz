import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import * as requestProcedures from "@/lib/services/requests.service";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const { otm_emp, otm_type, otm_date, otm_from, otm_to, otm_reason } = body;

    // Get settings for validation
    const settings = await prisma.settings_tab.findFirst();

    // TODO: Implement RequestLimit.BeforeAfter validation
    // For now, proceed with insertion

    // Filter seconds from time
    const filteredDateFrom = new Date(otm_from);
    filteredDateFrom.setSeconds(0, 0);
    const filteredDateTo = new Date(otm_to);
    filteredDateTo.setSeconds(0, 0);

    // Insert overtime request
    await requestProcedures.otInsertOtRequest(
      otm_emp,
      otm_type,
      new Date(otm_date),
      filteredDateFrom,
      filteredDateTo,
      otm_reason || ""
    );

    // Fetch and return the created overtime request
    const employee = payload.name;
    const result = await requestProcedures.displayGrid("OVT", employee);
    const createdOt = result?.[0] || null;

    return NextResponse.json(createdOt);
  } catch (error) {
    console.error("Create overtime error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
