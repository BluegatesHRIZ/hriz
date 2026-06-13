import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { verifyToken } from "@/lib/auth/jwt-edge"
import { authorizeApiRequest } from "@/lib/auth/authorization"

function parseTime(t: string | null | undefined): Date | null {
  if (!t) return null;
  // Accept "HH:mm" or "HH:mm:ss"
  return new Date(`1970-01-01T${t.length === 5 ? t + ":00" : t}Z`);
}

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
        await verifyToken(authHeader.substring(7))
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

/**
 * PUT /api/settings
 * Update system settings + company info (mirrors C# update_settings stored proc).
 * Requires AccessSettings permission.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminSettings");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { settings, company } = body as {
      settings: {
        set_din?: string; set_dbin?: string; set_dbout?: string; set_dout?: string;
        set_timeout?: string; set_graceperiod?: string; set_timeoffset?: string;
        set_minin?: string; set_ndst?: string; set_nden?: string;
        set_extid?: number; set_flex?: number; set_biobreak?: number; set_period?: number;
        set_user?: number; set_terminal?: number; set_device?: number;
        set_coabefore?: number; set_coaafter?: number; set_utmlead?: number;
        set_utmafter?: number; set_otmbefore?: number; set_otmafter?: number;
        set_scabefore?: number; set_scaafter?: number; set_yrdays?: number;
        set_wkdays?: number; set_halfmon?: number; set_includes?: number;
      };
      company: {
        com_name?: string; com_address?: string; com_email?: string;
        com_cntter?: number; com_cntmob?: number;
      };
    };

    const existing = await prisma.settings_tab.findFirst();
    if (!existing) {
      return NextResponse.json({ message: "Settings not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.settings_tab.update({
        where: { set_id: existing.set_id },
        data: {
          set_din: parseTime(settings.set_din),
          set_dbin: parseTime(settings.set_dbin),
          set_dbout: parseTime(settings.set_dbout),
          set_dout: parseTime(settings.set_dout),
          set_timeout: parseTime(settings.set_timeout),
          set_graceperiod: parseTime(settings.set_graceperiod),
          set_timeoffset: parseTime(settings.set_timeoffset),
          set_minin: parseTime(settings.set_minin),
          set_ndst: parseTime(settings.set_ndst),
          set_nden: parseTime(settings.set_nden),
          set_extid: settings.set_extid !== undefined ? String(settings.set_extid) : undefined,
          set_flex: settings.set_flex,
          set_biobreak: settings.set_biobreak,
          set_period: settings.set_period,
          set_user: settings.set_user,
          set_terminal: settings.set_terminal,
          set_device: settings.set_device,
          set_coabefore: settings.set_coabefore,
          set_coaafter: settings.set_coaafter,
          set_utmlead: settings.set_utmlead,
          set_utmafter: settings.set_utmafter,
          set_otmbefore: settings.set_otmbefore,
          set_otmafter: settings.set_otmafter,
          set_scabefore: settings.set_scabefore,
          set_scaafter: settings.set_scaafter,
          set_yrdays: settings.set_yrdays,
          set_wkdays: settings.set_wkdays,
          set_halfmon: settings.set_halfmon,
          set_includes: settings.set_includes,
        },
      }),
      prisma.company.updateMany({
        data: {
          com_name: company.com_name,
          com_address: company.com_address,
          com_email: company.com_email,
          com_cntter: company.com_cntter,
          com_cntmob: company.com_cntmob,
        },
      }),
    ]);

    return NextResponse.json({ message: "Settings updated" });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
