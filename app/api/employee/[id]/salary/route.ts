import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { saveEmployeeSalary } from "@/lib/services/employee.service";

/**
 * PUT /api/employee/{id}/salary
 * Replace employee salary history with the provided entries.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const resolvedParams = await params;
    const empId = resolvedParams.id;

    if (!empId || typeof empId !== "string") {
      return NextResponse.json(
        { message: "Employee ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { salaries } = body;

    if (!Array.isArray(salaries)) {
      return NextResponse.json(
        { message: "salaries must be an array" },
        { status: 400 }
      );
    }

    // Parse and validate entries
    const entries = salaries
      .map(
        (s: {
          SalPosition?: string;
          SalPayrollType?: string;
          SalDateFrom?: string | Date | null;
          SalDateTo?: string | Date | null;
          SalAmount?: number;
          SalRemarks?: string;
          SalStatus?: number;
        }) => {
          // Handle date parsing - can be string or Date object
          let dateFrom: Date | null = null;
          if (s.SalDateFrom) {
            if (s.SalDateFrom instanceof Date) {
              dateFrom = s.SalDateFrom;
            } else if (typeof s.SalDateFrom === "string") {
              dateFrom = new Date(s.SalDateFrom);
              if (isNaN(dateFrom.getTime())) {
                console.warn("Invalid SalDateFrom:", s.SalDateFrom);
                return null;
              }
            }
          }

          let dateTo: Date | null = null;
          if (s.SalDateTo) {
            if (s.SalDateTo instanceof Date) {
              dateTo = s.SalDateTo;
            } else if (typeof s.SalDateTo === "string") {
              dateTo = new Date(s.SalDateTo);
              if (isNaN(dateTo.getTime())) {
                console.warn("Invalid SalDateTo:", s.SalDateTo);
                dateTo = null; // Don't fail on invalid dateTo
              }
            }
          }

          return {
            SalPosition: s.SalPosition ?? "",
            SalPayrollType: s.SalPayrollType ?? "S",
            SalDateFrom: dateFrom,
            SalDateTo: dateTo,
            SalAmount: typeof s.SalAmount === "number" ? s.SalAmount : 0,
            SalRemarks: s.SalRemarks ?? "",
            SalStatus: typeof s.SalStatus === "number" ? s.SalStatus : 0,
          };
        }
      )
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    console.log("Saving salaries for employee:", empId, "Entries:", entries.length);

    await saveEmployeeSalary(empId, entries);

    return NextResponse.json({ message: "Salary history saved successfully" });
  } catch (error) {
    console.error("Save salary error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
