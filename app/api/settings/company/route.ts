import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

/**
 * GET /api/settings/company
 * Get company settings
 * Ported from SettingsController.GetCompanySettings
 */
export async function GET(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst()

    if (!company) {
      return NextResponse.json(
        { message: "Company not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(company)
  } catch (error) {
    console.error("Get company settings error:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
