import { NextRequest, NextResponse } from "next/server"
import { authorizeApiRequest } from "@/lib/auth/authorization"
import * as requestProcedures from "@/lib/services/requests.service"

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAttendanceChange")
    if (!auth.ok) return auth.response
    const payload = auth.payload

    const employee = payload.name // EmpId from JWT payload
    const result = await requestProcedures.displayGrid("COA", employee)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Get COA grid error:", error)
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
