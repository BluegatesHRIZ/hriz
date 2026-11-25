/**
 * Request types that go through approval, keyed by the `approvallevels.al_menu`
 * code. When an employee files a request, the approvers set for that code
 * receive it (see addForApproval in lib/services/requests.service.ts, whose
 * MODTYPE_MENU maps request id prefixes to these codes).
 */
export const APPROVAL_MODULES = [
  { code: "M1", label: "Leave" },
  { code: "M2", label: "Attendance Change" },
  { code: "M3", label: "Overtime" },
  { code: "M4", label: "Undertime" },
  { code: "M5", label: "Schedule Change" },
  { code: "M6", label: "Loan" },
] as const;

export type ApprovalModuleCode = (typeof APPROVAL_MODULES)[number]["code"];

export const APPROVAL_MODULE_CODES: readonly string[] = APPROVAL_MODULES.map((m) => m.code);

export const MAX_APPROVAL_LEVEL = 5;

export function approvalModuleLabel(code: string | null | undefined): string {
  return APPROVAL_MODULES.find((m) => m.code === code)?.label ?? code ?? "Unknown";
}

/** Same id the database trigger approvallevels_BEFORE_INSERT assigns. */
export function approvalLevelId(menu: string, approverId: string, empId: string): string {
  return `${menu}${approverId}${empId}`;
}
