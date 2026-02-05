import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import * as requestProcedures from "@/lib/services/requests.service";

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
    const { LoaAmt, LoaReason, LoaType, LoaExprelease } = body;

    if (LoaAmt <= 0) {
      return NextResponse.json(
        { message: "Input your loan amount." },
        { status: 400 }
      );
    }

    if (!LoaReason || LoaReason.trim() === "") {
      return NextResponse.json(
        { message: "Input your loan reason." },
        { status: 400 }
      );
    }

    const employee = payload.name; // EmpId from JWT payload

    // Insert loan request
    await requestProcedures.loanInsertRequest(
      LoaAmt,
      LoaReason,
      LoaType || "",
      LoaExprelease ? new Date(LoaExprelease) : null,
      employee
    );

    return NextResponse.json({ message: "Loan request created" });
  } catch (error) {
    console.error("Create loan error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
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

    const result = await requestProcedures.loanManagementList();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get loan management list error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
