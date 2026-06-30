import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import * as requestProcedures from "@/lib/services/requests.service";
import { parsePagination, paginate } from "@/lib/pagination";
import { statusGroupToCodes } from "@/lib/requests/status";

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiLoan");
    if (!auth.ok) return auth.response;
    const payload = auth.payload;

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
    const auth = await authorizeApiRequest(request, "apiLoan");
    if (!auth.ok) return auth.response;
    const payload = auth.payload;

    const employee = payload.name;
    const { page, limit, skip, take } = parsePagination(request.nextUrl.searchParams);
    const statuses = statusGroupToCodes(request.nextUrl.searchParams.get("status"));
    const { data, total } = await requestProcedures.displayGrid("LOA", employee, { skip, take, statuses });

    return NextResponse.json(paginate(data, total, page, limit));
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
