import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import * as requestProcedures from "@/lib/services/requests.service";

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiScheduleChange");
    if (!auth.ok) return auth.response;
    const payload = auth.payload;

    const employee = payload.name;
    const result = await requestProcedures.displayGrid("SCA", employee);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Get schedule adjust list error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

