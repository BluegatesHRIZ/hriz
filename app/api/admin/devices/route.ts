import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { parsePagination, paginate } from "@/lib/pagination";

/**
 * GET /api/admin/devices
 * List all terminals (excluding rejected status=2). Requires RegisterDevice.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminDevices");
    if (!auth.ok) return auth.response;

    const { page, limit, skip, take } = parsePagination(request.nextUrl.searchParams);

    const where = { ter_status: { not: 2 } };
    const [total, devices] = await Promise.all([
      prisma.terminal.count({ where }),
      prisma.terminal.findMany({
        where,
        orderBy: { ter_logdate: "desc" },
        skip,
        take,
      }),
    ]);

    // Enrich location codes with human-readable descriptions
    const locations = await prisma.location.findMany({
      select: { loc_id: true, loc_desc: true },
    });
    const locMap = new Map(locations.map((l) => [l.loc_id, l.loc_desc]));

    const enriched = devices.map((d) => ({
      ...d,
      ter_loc_desc: d.ter_loc ? locMap.get(d.ter_loc) ?? null : null,
    }));

    return NextResponse.json(paginate(enriched, total, page, limit));
  } catch (error) {
    console.error("Admin devices GET error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/devices
 * Register a new terminal/device. Requires RegisterDevice.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminDevices");
    if (!auth.ok) return auth.response;

    const body = await request.json() as {
      ter_code: string;
      ter_id: string;
      ter_ip: string;
      ter_loc?: string;
      ter_biopass?: string;
      ter_biokey?: string;
      ter_device?: string;
      ter_type?: number;
    };

    if (!body.ter_code?.trim() || !body.ter_id?.trim()) {
      return NextResponse.json({ message: "Device code and name are required." }, { status: 400 });
    }

    // Enforce terminal/device limits from settings
    const settings = await prisma.settings_tab.findFirst();
    if (settings) {
      if (body.ter_type === 0) {
        const count = await prisma.terminal.count({ where: { ter_type: 0, ter_status: 1 } });
        if (count >= (settings.set_terminal ?? 0)) {
          return NextResponse.json({ message: "Terminal limit reached." }, { status: 400 });
        }
      }
      if (body.ter_type === 1) {
        const count = await prisma.terminal.count({ where: { ter_type: 1, ter_status: 1 } });
        if (count >= (settings.set_device ?? 0)) {
          return NextResponse.json({ message: "Device limit reached." }, { status: 400 });
        }
      }
    }

    const created = await prisma.terminal.create({
      data: {
        ter_code: body.ter_code.trim(),
        ter_id: body.ter_id.trim(),
        ter_ip: body.ter_ip?.trim() ?? null,
        ter_loc: body.ter_loc?.trim() ?? null,
        ter_biopass: body.ter_biopass?.trim() ?? null,
        ter_biokey: body.ter_biokey?.trim() ?? "",
        ter_device: body.ter_device?.trim() ?? null,
        ter_type: body.ter_type ?? 0,
        ter_status: 0, // pending authorization
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ message: "Device code already exists." }, { status: 409 });
    }
    console.error("Admin devices POST error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
