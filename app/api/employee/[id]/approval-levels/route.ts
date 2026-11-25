import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import {
  addApprover,
  ApprovalLevelError,
  getApprovalChain,
  removeApprover,
} from "@/lib/services/approvalLevels.service";
import { MAX_APPROVAL_LEVEL } from "@/lib/requests/approvalModules";
import type {
  AddApproverRequest,
  ApprovalChain,
  RemoveApproverResponse,
} from "@/lib/types";

async function requireLogin(request: NextRequest): Promise<NextResponse | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    await verifyToken(authHeader.substring(7));
  } catch {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }
  return null;
}

function parseLevel(value: unknown): number | null {
  const level = Number(value);
  return Number.isInteger(level) && level >= 1 && level <= MAX_APPROVAL_LEVEL ? level : null;
}

function serverError(label: string, error: unknown) {
  console.error(`Approval levels ${label} error:`, error);
  return NextResponse.json({ message: "Internal server error" }, { status: 500 });
}

/** GET /api/employee/{id}/approval-levels: the employee's approval chain. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireLogin(request);
  if (denied) return denied;
  try {
    const { id: empId } = await params;
    const chain: ApprovalChain = await getApprovalChain(empId);
    return NextResponse.json(chain);
  } catch (error) {
    return serverError("GET", error);
  }
}

/** POST /api/employee/{id}/approval-levels: add an approver at a level. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireLogin(request);
  if (denied) return denied;
  try {
    const { id: empId } = await params;
    const body = (await request.json()) as Partial<AddApproverRequest>;
    const level = parseLevel(body.Level);
    if (!body.ApproverId || typeof body.ApproverId !== "string") {
      return NextResponse.json({ message: "Approver is required" }, { status: 400 });
    }
    if (level == null) {
      return NextResponse.json({ message: `Level must be 1 to ${MAX_APPROVAL_LEVEL}` }, { status: 400 });
    }
    const result = await addApprover(empId, body.ApproverId, level);
    return NextResponse.json(result, { status: result.addedTypes ? 201 : 200 });
  } catch (error) {
    if (error instanceof ApprovalLevelError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return serverError("POST", error);
  }
}

/** DELETE /api/employee/{id}/approval-levels?approver=...&level=...: remove an approver. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireLogin(request);
  if (denied) return denied;
  try {
    const { id: empId } = await params;
    const approverId = request.nextUrl.searchParams.get("approver");
    const level = parseLevel(request.nextUrl.searchParams.get("level"));
    if (!approverId || level == null) {
      return NextResponse.json({ message: "approver and level are required" }, { status: 400 });
    }
    const removed = await removeApprover(empId, approverId, level);
    if (!removed) return NextResponse.json({ message: "Approver not found" }, { status: 404 });
    const response: RemoveApproverResponse = { message: "Approver removed" };
    return NextResponse.json(response);
  } catch (error) {
    return serverError("DELETE", error);
  }
}
