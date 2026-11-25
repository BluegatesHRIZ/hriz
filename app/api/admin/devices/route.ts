import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { parsePagination, paginate } from "@/lib/pagination";
import {
  TERMINAL_PRIVATE_COLUMNS,
  TERMINAL_STATUS,
  deviceLookups,
  getTerminalLimits,
  toDeviceDTO,
} from "@/lib/services/device.service";
import type { DeviceListFilter, DeviceListResponse } from "@/lib/types/devices";
import type { Prisma } from "../../../../src/generated/prisma/client";

const LIST_WHERE: Record<DeviceListFilter, Prisma.terminalWhereInput> = {
  pending: { ter_status: TERMINAL_STATUS.pending },
  authorized: { ter_status: TERMINAL_STATUS.approved },
  all: { ter_status: { not: TERMINAL_STATUS.rejected } },
};

/**
 * GET /api/admin/devices?status=pending|authorized|all
 * Lists terminals (never rejected ones) with the count behind each tab.
 * Requires RegisterDevice.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminDevices");
    if (!auth.ok) return auth.response;

    const { page, limit, skip, take } = parsePagination(request.nextUrl.searchParams);
    const requested = request.nextUrl.searchParams.get("status");
    const filter: DeviceListFilter =
      requested === "pending" || requested === "authorized" ? requested : "all";
    const where = LIST_WHERE[filter];

    const [devices, pending, authorized, all, limits] = await Promise.all([
      prisma.terminal.findMany({
        where,
        omit: TERMINAL_PRIVATE_COLUMNS,
        // Requests waiting for a decision first, newest first within each.
        orderBy: [{ ter_status: "asc" }, { ter_logdate: "desc" }],
        skip,
        take,
      }),
      prisma.terminal.count({ where: LIST_WHERE.pending }),
      prisma.terminal.count({ where: LIST_WHERE.authorized }),
      prisma.terminal.count({ where: LIST_WHERE.all }),
      getTerminalLimits(),
    ]);
    const counts = { pending, authorized, all };

    // Location descriptions and the names of the people who requested each device
    const lookups = await deviceLookups(devices);
    const enriched = devices.map((d) => toDeviceDTO(d, lookups));

    return NextResponse.json<DeviceListResponse>({
      ...paginate(enriched, counts[filter], page, limit),
      counts,
      limits,
    });
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

    // No limit check here: a new device waits for approval, and the limit in
    // Settings is enforced when it is authorized (PUT /api/admin/devices/[id]).
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
      omit: TERMINAL_PRIVATE_COLUMNS,
    });

    return NextResponse.json(toDeviceDTO(created, await deviceLookups([created])), { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ message: "Device code already exists." }, { status: 409 });
    }
    console.error("Admin devices POST error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
