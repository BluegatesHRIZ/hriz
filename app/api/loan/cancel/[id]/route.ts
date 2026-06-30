import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import * as requestProcedures from "@/lib/services/requests.service";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authorizeApiRequest(request, "apiLoan");
    if (!auth.ok) return auth.response;
    const payload = auth.payload;

    const resolvedParams = await params;
    const loanId = resolvedParams.id;
    const username = payload.name;

    await requestProcedures.cancelRequest(loanId, username);
    const { data } = await requestProcedures.displayGrid("LOA", username);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Cancel loan error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

