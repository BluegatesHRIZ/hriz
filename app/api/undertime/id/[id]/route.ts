import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiUndertime");
    if (!auth.ok) return auth.response;
    const payload = auth.payload;

    const resolvedParams = await params;
    const utId = resolvedParams.id;
    const username = payload.name; // EmpId from JWT payload

    const undertime = await prisma.undertime.findFirst({
      where: {
        utm_id: utId,
        utm_emp: username,
      },
    });

    if (!undertime) {
      return NextResponse.json(
        { message: "Undertime not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      UtmId: undertime.utm_id,
      UtmEmp: undertime.utm_emp,
      UtmDate: undertime.utm_date,
      UtmFrom: undertime.utm_from,
      UtmTo: undertime.utm_to,
      UtmReason: undertime.utm_reason,
      UtmStatus: undertime.utm_status,
      UtmApplieddate: undertime.utm_applieddate,
      UtmApproveddate: undertime.utm_approveddate,
      UtmApprovedby: undertime.utm_approvedby,
    });
  } catch (error) {
    console.error("Get undertime error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
