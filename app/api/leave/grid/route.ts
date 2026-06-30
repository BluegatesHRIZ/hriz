import { NextRequest, NextResponse } from "next/server"
import { authorizeApiRequest } from "@/lib/auth/authorization"
import * as requestProcedures from "@/lib/services/requests.service"
import { parsePagination, paginate } from "@/lib/pagination"
import { statusGroupToCodes } from "@/lib/requests/status"

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiLeave")
    if (!auth.ok) return auth.response
    const payload = auth.payload

    const employee = payload.name // EmpId from JWT payload
    const { page, limit, skip, take } = parsePagination(request.nextUrl.searchParams)
    const statuses = statusGroupToCodes(request.nextUrl.searchParams.get("status"))
    const { data, total } = await requestProcedures.displayGrid("LEA", employee, { skip, take, statuses })

    return NextResponse.json(paginate(data, total, page, limit))
  } catch (error) {
    console.error("Get leave grid error:", error)
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
