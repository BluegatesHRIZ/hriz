import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { createEmployeeAccount } from "@/lib/services/employee.service";

/**
 * GET /api/employee
 * List all employees (for display in Employee List)
 * Ported from EmployeeController.GetEmployeeList
 */
export async function GET(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const employees = await prisma.employee.findMany({
      where: {
        emp_status: 1, // Only active employees
      },
      select: {
        emp_id: true,
        emp_first: true,
        emp_last: true,
        emp_mid: true,
        emp_dept: true,
        emp_pos: true,
        emp_loc: true,
        emp_role: true,
        emp_status: true,
        emp_extid: true,
        emp_datecreated: true,
      },
      orderBy: {
        emp_last: "asc",
      },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error("Get employee list error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/employee
 * Create a new employee account (employee + optional personal data).
 * Mirrors the core of ManageEmployeeController.CreateEmployee (account + personal).
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const createdByEmpId = payload.name;
    if (!createdByEmpId) {
      return NextResponse.json(
        { message: "Unable to identify creator" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { Account, Personal } = body as {
      Account?: {
        EmpFirst?: string;
        EmpMid?: string | null;
        EmpLast?: string;
        EmpDept?: string | null;
        EmpPos?: string | null;
        EmpLoc?: string | null;
        EmpRole?: string | null;
        EmpExternalId?: string | null;
        EmpPswd?: string | null;
      };
      Personal?: {
        EmpAddress?: string | null;
        EmpBirthday?: string | Date | null;
        EmpMother?: string | null;
        EmpFather?: string | null;
        EmpGender?: string | null;
        EmpCivil?: string | null;
        EmpSpouse?: string | null;
        EmpContact1?: string | null;
        EmpContact2?: string | null;
        EmpEmail?: string | null;
        EmpAccount?: string | null;
      } | null;
    };

    if (!Account || !Account.EmpFirst || !Account.EmpLast) {
      return NextResponse.json(
        { message: "Account.EmpFirst and Account.EmpLast are required" },
        { status: 400 }
      );
    }

    const personalNormalized =
      Personal != null
        ? {
            EmpAddress: Personal.EmpAddress ?? null,
            EmpBirthday: Personal.EmpBirthday
              ? new Date(Personal.EmpBirthday)
              : null,
            EmpMother: Personal.EmpMother ?? null,
            EmpFather: Personal.EmpFather ?? null,
            EmpGender: Personal.EmpGender ?? null,
            EmpCivil: Personal.EmpCivil ?? null,
            EmpSpouse: Personal.EmpSpouse ?? null,
            EmpContact1: Personal.EmpContact1 ?? null,
            EmpContact2: Personal.EmpContact2 ?? null,
            EmpEmail: Personal.EmpEmail ?? null,
            EmpAccount: Personal.EmpAccount ?? null,
          }
        : null;

    const created = await createEmployeeAccount(
      {
        EmpFirst: Account.EmpFirst,
        EmpMid: Account.EmpMid ?? null,
        EmpLast: Account.EmpLast,
        EmpDept: Account.EmpDept ?? null,
        EmpPos: Account.EmpPos ?? null,
        EmpLoc: Account.EmpLoc ?? null,
        EmpRole: Account.EmpRole ?? "EMPLOYEE",
        EmpExternalId: Account.EmpExternalId ?? null,
        EmpPswd: Account.EmpPswd ?? null,
      },
      personalNormalized,
      createdByEmpId
    );

    return NextResponse.json(
      {
        emp_id: created.emp_id,
        emp_first: created.emp_first,
        emp_last: created.emp_last,
        emp_mid: created.emp_mid,
        emp_dept: created.emp_dept,
        emp_pos: created.emp_pos,
        emp_loc: created.emp_loc,
        emp_role: created.emp_role,
        emp_extid: created.emp_extid,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create employee error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
