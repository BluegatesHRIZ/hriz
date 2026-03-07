import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import * as requestProcedures from "@/lib/services/requests.service";
import { prisma } from "@/lib/db/prisma";
import { removeSeconds } from "@/lib/utils/time";
import { beforeAfter } from "@/lib/utils/requestLimit";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const { CoaStype, CoaStypedetail, CoaSreason, CoaSemp, CoaDetails } = body;

    // Get settings for validation
    const settings = await prisma.settings_tab.findFirst();

    // Insert COA summary
    const coaSid = await requestProcedures.coaSummaryInsert(
      CoaStype,
      CoaStypedetail || "",
      CoaSreason || "",
      CoaSemp,
    );

    // Validate and insert COA details
    if (Array.isArray(CoaDetails)) {
      for (const detail of CoaDetails) {
        // Validate date with BeforeAfter (matches C# validation)
        if (settings) {
          const detailDate = new Date(detail.CoaDdate);
          if (
            beforeAfter(
              detailDate,
              settings.set_coabefore ?? 0,
              settings.set_coaafter ?? 0,
            )
          ) {
            return NextResponse.json(
              { message: "Attendance change date is not allowed" },
              { status: 400 },
            );
          }
        }

        const filteredTime = removeSeconds(new Date(detail.CoaDtime));
        await requestProcedures.coaDetailsInsert(
          coaSid,
          detail.CoaDtype,
          new Date(detail.CoaDdate),
          filteredTime,
        );
      }
    }

    return NextResponse.json(body);
  } catch (error) {
    console.error("Create COA error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
