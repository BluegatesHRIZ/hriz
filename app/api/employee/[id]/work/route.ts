import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import {
  insertEmployeeWork,
  deleteEmployeeApprovalLevels,
  addApprovalLevel,
} from "@/lib/services/employee.service";

/**
 * PUT /api/employee/{id}/work
 * Save employee work information including approval levels
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authorization
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    // In Next.js 15+, params is a Promise - await it
    const resolvedParams = await params;
    const empId = resolvedParams.id;

    if (!empId || typeof empId !== "string") {
      return NextResponse.json(
        { message: "Employee ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      emp_code,
      emp_type,
      emp_datehired,
      emp_dateexp,
      emp_datereg,
      emp_supervisor,
      emp_remarks,
      emp_sss,
      emp_philhealth,
      emp_pagibig,
      emp_tin,
      emp_taxstat,
      emp_rdo,
      emp_passport,
      emp_prc,
      approvalLevels,
    } = body;

    // Update work information
    await insertEmployeeWork(
      empId,
      emp_code || null,
      emp_type || 1,
      emp_datehired ? new Date(emp_datehired) : null,
      emp_dateexp ? new Date(emp_dateexp) : null,
      emp_datereg ? new Date(emp_datereg) : null,
      emp_remarks || null,
      emp_supervisor || "None",
      emp_sss || null,
      emp_philhealth || null,
      emp_pagibig || null,
      emp_tin || null,
      emp_taxstat || null,
      emp_rdo || null,
      emp_passport || null,
      emp_prc || null
    );

    // Update approval levels
    // Delete all existing approval levels
    await deleteEmployeeApprovalLevels(empId);

    // Insert new approval levels
    if (approvalLevels && Array.isArray(approvalLevels)) {
      for (const approver of approvalLevels) {
        if (
          approver.AlApprv &&
          approver.AlApprv !== "" &&
          approver.AlApprv !== "None" &&
          approver.AlLevel
        ) {
          await addApprovalLevel(empId, approver.AlApprv, approver.AlLevel);
        }
      }
    }

    return NextResponse.json({
      message: "Work information saved successfully",
    });
  } catch (error) {
    console.error("Save work information error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
