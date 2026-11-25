import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import {
  TERMINAL_PRIVATE_COLUMNS,
  deviceLookups,
  isTerminalLimitReached,
  toDeviceDTO,
} from "@/lib/services/device.service";

/**
 * PUT /api/admin/devices/[id]
 * Update terminal status or fields. Requires RegisterDevice.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminDevices");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json() as {
      ter_id?: string;
      ter_ip?: string;
      ter_loc?: string;
      ter_biopass?: string;
      ter_device?: string;
      ter_status?: number;
    };

    // Enforce the limit in Settings when authorizing (status 1)
    if (body.ter_status === 1) {
      const existing = await prisma.terminal.findUnique({
        where: { ter_code: id },
        select: { ter_type: true, ter_status: true },
      });
      if (existing && existing.ter_status !== 1 && (await isTerminalLimitReached(existing.ter_type))) {
        const setting = existing.ter_type === 1 ? "Number of Devices" : "Number of Terminals";
        return NextResponse.json(
          {
            message: `The limit in Settings (${setting}) is reached. Unauthorize or remove a device, or raise the limit, to approve this one.`,
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.terminal.update({
      where: { ter_code: id },
      data: {
        ter_id: body.ter_id,
        ter_ip: body.ter_ip,
        ter_loc: body.ter_loc,
        ter_biopass: body.ter_biopass,
        ter_device: body.ter_device,
        ter_status: body.ter_status,
      },
      omit: TERMINAL_PRIVATE_COLUMNS,
    });

    return NextResponse.json(toDeviceDTO(updated, await deviceLookups([updated])));
  } catch (error) {
    console.error("Admin devices PUT error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/devices/[id]
 * Reject device (set status to 2). Requires RegisterDevice.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminDevices");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    await prisma.terminal.update({
      where: { ter_code: id },
      data: { ter_status: 2 },
    });

    return NextResponse.json({ message: "Device rejected." });
  } catch (error) {
    console.error("Admin devices DELETE error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
