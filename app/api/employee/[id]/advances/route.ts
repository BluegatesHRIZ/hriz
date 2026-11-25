import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { insertEmployeeAdvance } from "@/lib/services/employee.service";
import type { CreateAdvanceRequest, CreateAdvanceResponse } from "@/lib/types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validate(body: Partial<CreateAdvanceRequest>): string | null {
  if (!body.AdvType || typeof body.AdvType !== "string") return "Loan type is required";
  if (!(Number(body.AdvAmount) > 0)) return "Loan amount must be greater than zero";
  if (Number(body.AddedAmount ?? 0) < 0) return "Added amount cannot be negative";
  if (!(Number(body.AmountPerPay) > 0)) return "Installment amount must be greater than zero";
  if (body.PayPerMonth !== 1 && body.PayPerMonth !== 2) return "Monthly installment must be once or twice";
  if (body.PayCutoff != null && body.PayCutoff !== 1 && body.PayCutoff !== 2) return "Invalid applied installment";
  if (!body.AdvDate || !DATE.test(body.AdvDate)) return "Date issued is required";
  if (!body.StartDate || !DATE.test(body.StartDate)) return "Date start is required";
  return null;
}

/**
 * POST /api/employee/{id}/advances
 * Add one advance or loan (employee_insert_advances).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    const { id: empId } = await params;
    if (!empId) {
      return NextResponse.json({ message: "Employee ID is required" }, { status: 400 });
    }

    const body = (await request.json()) as Partial<CreateAdvanceRequest>;
    const problem = validate(body);
    if (problem) {
      return NextResponse.json({ message: problem }, { status: 400 });
    }

    const code = await insertEmployeeAdvance(empId, {
      AdvType: body.AdvType!.trim(),
      AdvDate: body.AdvDate!,
      AdvAmount: Number(body.AdvAmount),
      AddedAmount: Number(body.AddedAmount ?? 0),
      PayPerMonth: body.PayPerMonth!,
      PayCutoff: body.PayPerMonth === 1 ? body.PayCutoff ?? null : null,
      StartDate: body.StartDate!,
      AmountPerPay: Number(body.AmountPerPay),
    });

    const response: CreateAdvanceResponse = { message: "Advance added", AdvCode: code };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Add advance error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
