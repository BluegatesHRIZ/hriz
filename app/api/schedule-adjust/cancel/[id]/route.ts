import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import * as requestProcedures from "@/lib/services/requests.service";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiScheduleChange");
    if (!auth.ok) return auth.response;
    const payload = auth.payload;

    const resolvedParams = await params;
    const scaId = resolvedParams.id;
    const username = payload.name; // EmpId from JWT payload

    // Cancel the request
    await requestProcedures.cancelRequest(scaId, username);

    const { data } = await requestProcedures.displayGrid("SCA", username);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Cancel schedule adjustment error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
