import { prisma } from "@/lib/db/prisma";
import {
  APPROVAL_MODULE_CODES,
  approvalLevelId,
  approvalModuleLabel,
} from "@/lib/requests/approvalModules";
import type { AddApproverResponse, ApprovalChain, ChainLevel } from "@/lib/types";

function fullName(e: { emp_last: string | null; emp_first: string | null }): string | null {
  const name = [e.emp_last, e.emp_first].filter(Boolean).join(", ");
  return name || null;
}

export class ApprovalLevelError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * The employee's approval chain: who approves at each level. Rows for the
 * separate request types are folded together per approver and level.
 */
export async function getApprovalChain(empId: string): Promise<ApprovalChain> {
  const rows = await prisma.approvallevels.findMany({
    where: { al_emp: empId, al_appvr: { not: null }, al_menu: { not: null } },
    select: { al_appvr: true, al_menu: true, al_level: true },
  });

  const approverIds = [...new Set(rows.map((r) => r.al_appvr!).filter(Boolean))];
  const approvers = approverIds.length
    ? await prisma.employee.findMany({
        where: { emp_id: { in: approverIds } },
        select: { emp_id: true, emp_last: true, emp_first: true },
      })
    : [];
  const nameById = new Map(approvers.map((a) => [a.emp_id, fullName(a)] as const));

  // level -> approver -> request types
  const byLevel = new Map<number, Map<string, Set<string>>>();
  for (const r of rows) {
    if (!r.al_appvr) continue;
    const level = r.al_level ?? 1;
    const approversAtLevel = byLevel.get(level) ?? new Map<string, Set<string>>();
    const types = approversAtLevel.get(r.al_appvr) ?? new Set<string>();
    types.add(r.al_menu!);
    approversAtLevel.set(r.al_appvr, types);
    byLevel.set(level, approversAtLevel);
  }

  const levels: ChainLevel[] = [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, approversAtLevel]) => ({
      Level: level,
      Approvers: [...approversAtLevel.entries()]
        .map(([id, types]) => {
          const missing = APPROVAL_MODULE_CODES.filter((code) => !types.has(code));
          return {
            ApproverId: id,
            ApproverName: nameById.get(id) ?? null,
            CoversAllTypes: missing.length === 0,
            MissingTypes: missing.map((code) => approvalModuleLabel(code)),
          };
        })
        .sort((a, b) => (a.ApproverName ?? a.ApproverId).localeCompare(b.ApproverName ?? b.ApproverId)),
    }));

  const selfApproved =
    levels.length === 1 &&
    levels[0].Approvers.length === 1 &&
    levels[0].Approvers[0].ApproverId === empId;

  return { EmpId: empId, Levels: levels, SelfApproved: selfApproved };
}

/**
 * Mark an employee N/A: replace their whole chain with themselves at Level 1
 * for every request type, so their requests come back to them to approve.
 */
export async function setSelfApproval(empId: string): Promise<void> {
  const employee = await prisma.employee.findUnique({
    where: { emp_id: empId },
    select: { emp_id: true },
  });
  if (!employee) throw new ApprovalLevelError("Employee not found", 404);

  await prisma.$transaction([
    prisma.approvallevels.deleteMany({ where: { al_emp: empId } }),
    prisma.approvallevels.createMany({
      data: APPROVAL_MODULE_CODES.map((code) => ({
        al_id: approvalLevelId(code, empId, empId),
        al_emp: empId,
        al_appvr: empId,
        al_menu: code,
        al_level: 1,
        al_stat: 1,
      })),
    }),
  ]);
}

/**
 * Make someone an approver at a level for every request type. Types where they
 * are already an approver (at any level) are left as they are.
 */
export async function addApprover(
  empId: string,
  approverId: string,
  level: number,
): Promise<AddApproverResponse> {
  if (approverId === empId) {
    throw new ApprovalLevelError(
      "An employee cannot be their own approver in a chain. Use Set as N/A instead.",
      400,
    );
  }
  const approver = await prisma.employee.findUnique({
    where: { emp_id: approverId },
    select: { emp_id: true },
  });
  if (!approver) throw new ApprovalLevelError("Approver not found", 404);

  // al_id is menu + approver + employee, so one approver can only sit at one
  // level per request type.
  const existing = await prisma.approvallevels.findMany({
    where: { al_emp: empId, al_appvr: approverId },
    select: { al_menu: true, al_level: true },
  });
  const elsewhere = existing.find((e) => (e.al_level ?? 1) !== level);
  if (elsewhere) {
    throw new ApprovalLevelError(
      `This person is already in the chain at Level ${elsewhere.al_level ?? 1}.`,
      409,
    );
  }
  const covered = new Set(existing.map((e) => e.al_menu));
  const toAdd = APPROVAL_MODULE_CODES.filter((code) => !covered.has(code));

  // An N/A employee (only approver is themselves) who gets a real approver is
  // no longer N/A: drop the self rows in the same step, so the employee is
  // never left with nobody.
  const others = await prisma.approvallevels.count({
    where: { al_emp: empId, al_appvr: { not: empId } },
  });
  const leavingSelfApproval = others === 0;

  if (toAdd.length) {
    await prisma.$transaction([
      ...(leavingSelfApproval
        ? [prisma.approvallevels.deleteMany({ where: { al_emp: empId, al_appvr: empId } })]
        : []),
      prisma.approvallevels.createMany({
        data: toAdd.map((code) => ({
          al_id: approvalLevelId(code, approverId, empId),
          al_emp: empId,
          al_appvr: approverId,
          al_menu: code,
          al_level: level,
          al_stat: 1,
        })),
      }),
    ]);
  }

  return {
    message: toAdd.length ? "Approver added" : "Already an approver at this level",
    addedTypes: toAdd.length,
  };
}

/** Remove an approver at a level, for every request type. Returns rows removed. */
export async function removeApprover(
  empId: string,
  approverId: string,
  level: number,
): Promise<number> {
  const result = await prisma.approvallevels.deleteMany({
    where: { al_emp: empId, al_appvr: approverId, al_level: level },
  });
  return result.count;
}
