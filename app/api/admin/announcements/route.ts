import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { parsePagination, paginate } from "@/lib/pagination";

/**
 * GET /api/admin/announcements
 * List all announcements (all statuses). Requires AccessAnnouncement.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminAnnouncements");
    if (!auth.ok) return auth.response;

    const { page, limit, skip, take } = parsePagination(request.nextUrl.searchParams);

    const [total, list] = await Promise.all([
      prisma.announce.count(),
      prisma.announce.findMany({
        orderBy: { an_startdate: "desc" },
        skip,
        take,
      }),
    ]);

    return NextResponse.json(paginate(list, total, page, limit));
  } catch (error) {
    console.error("Admin announcements GET error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/announcements
 * Create a new announcement. Requires CreateAnnouncement.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminAnnouncements");
    if (!auth.ok) return auth.response;

    const body = await request.json() as {
      an_headline: string;
      an_message: string;
      an_type: string;
      an_startdate: string;
      an_enddate: string;
      an_repeat: number;
      an_status: number;
    };

    const created = await prisma.announce.create({
      data: {
        an_headline: body.an_headline,
        an_message: body.an_message,
        an_type: body.an_type ?? "regular",
        an_startdate: new Date(body.an_startdate),
        an_enddate: new Date(body.an_enddate),
        an_repeat: body.an_repeat ?? 0,
        an_status: body.an_status ?? 1,
        an_by: auth.payload.name ?? null,
        an_logdate: new Date(),
        an_modified: new Date(),
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Admin announcements POST error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
