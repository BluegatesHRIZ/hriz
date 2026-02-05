import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { verifyToken } from "@/lib/auth/jwt"

/**
 * GET /api/settings
 * Get system settings
 * Ported from SettingsController.GetSettings
 */
export async function GET(request: NextRequest) {
  try {
    // Settings can be accessed without auth for login page
    // But we'll check auth header if provided
    const authHeader = request.headers.get("authorization")
    if (authHeader?.startsWith("Bearer ")) {
      try {
        verifyToken(authHeader.substring(7))
      } catch {
        // Invalid token, but allow access for public settings
      }
    }

    const settings = await prisma.settings_tab.findFirst()

    if (!settings) {
      return NextResponse.json(
        { message: "Settings not found" },
        { status: 404 }
      )
    }

    // Map Prisma model to DTO format
    const settingsDTO = {
      set_id: settings.set_id,
      set_din: settings.set_din,
      set_dbin: settings.set_dbin,
      set_dbout: settings.set_dbout,
      set_dout: settings.set_dout,
      set_timeout: settings.set_timeout,
      set_graceperiod: settings.set_graceperiod,
      set_extid: settings.set_extid === "1" || settings.set_extid === "1" ? 1 : 0,
      set_beta: settings.set_beta,
      set_user: settings.set_user,
      set_terminal: settings.set_terminal,
      set_device: settings.set_device,
      set_timeoffset: settings.set_timeoffset,
      set_coabefore: settings.set_coabefore,
      set_coaafter: settings.set_coaafter,
      set_utmlead: settings.set_utmlead,
      set_utmafter: settings.set_utmafter,
      set_otmbefore: settings.set_otmbefore,
      set_otmafter: settings.set_otmafter,
      set_scabefore: settings.set_scabefore,
      set_scaafter: settings.set_scaafter,
      set_ndst: settings.set_ndst,
      set_nden: settings.set_nden,
      set_yrdays: settings.set_yrdays,
      set_wkdays: settings.set_wkdays,
      set_halfmon: settings.set_halfmon,
      set_includes: settings.set_includes,
      set_flex: settings.set_flex,
      set_period: settings.set_period,
      set_biobreak: settings.set_biobreak,
      set_minin: settings.set_minin,
    }

    return NextResponse.json(settingsDTO)
  } catch (error) {
    console.error("Get settings error:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
