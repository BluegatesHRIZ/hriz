import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";

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

    // Enforce limits when authorizing (status → 1)
    if (body.ter_status === 1) {
      const existing = await prisma.terminal.findUnique({ where: { ter_code: id } });
      const settings = await prisma.settings_tab.findFirst();
      if (settings && existing) {
        if (existing.ter_type === 0) {
          const count = await prisma.terminal.count({ where: { ter_type: 0, ter_status: 1 } });
          if (count >= (settings.set_terminal ?? 0)) {
            return NextResponse.json({ message: "Terminal limit reached." }, { status: 400 });
          }
        }
        if (existing.ter_type === 1) {
          const count = await prisma.terminal.count({ where: { ter_type: 1, ter_status: 1 } });
          if (count >= (settings.set_device ?? 0)) {
            return NextResponse.json({ message: "Device limit reached." }, { status: 400 });
          }
        }
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
    });

    return NextResponse.json(updated);
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
