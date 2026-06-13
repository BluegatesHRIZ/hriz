import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";

/**
 * PUT /api/admin/announcements/[id]
 * Update an announcement. Requires EditAnnouncement.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminAnnouncements");
    if (!auth.ok) return auth.response;

    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ message: "Invalid id" }, { status: 400 });

    const body = await request.json() as {
      an_headline: string;
      an_message: string;
      an_type: string;
      an_startdate: string;
      an_enddate: string;
      an_repeat: number;
      an_status: number;
    };

    const updated = await prisma.announce.update({
      where: { an_id: id },
      data: {
        an_headline: body.an_headline,
        an_message: body.an_message,
        an_type: body.an_type,
        an_startdate: new Date(body.an_startdate),
        an_enddate: new Date(body.an_enddate),
        an_repeat: body.an_repeat,
        an_status: body.an_status,
        an_by: auth.payload.name ?? null,
        an_modified: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Admin announcements PUT error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/announcements/[id]
 * Delete an announcement. Requires DeleteAnnouncement.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminAnnouncements");
    if (!auth.ok) return auth.response;

    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ message: "Invalid id" }, { status: 400 });

    await prisma.announce.delete({ where: { an_id: id } });

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Admin announcements DELETE error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
