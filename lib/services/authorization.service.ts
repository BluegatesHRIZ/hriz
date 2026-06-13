import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS, type PermissionName, combinePermissions } from "@/lib/auth/permissions";

type PermissionMap = Record<string, bigint>;
const BIGINT_ZERO = BigInt(0);

type PermissionCache = {
  expiresAt: number;
  routePermissions: PermissionMap;
  menuPermissions: PermissionMap;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: PermissionCache | null = null;

const MENU_TO_PERMISSION_NAMES: Record<string, PermissionName[]> = {
  A1: ["AccessEmployee", "AllAccess"],
  A2: ["AccessAnnouncement", "AllAccess"],
  A3: ["AccessHoliday", "AllAccess"],
  A4: ["AccessMasterfile", "AllAccess"],
  A5: ["AdministrationRolesAndPermissions", "AllAccess"],
  A6: ["RegisterDevice", "AllAccess"],
  A8: ["AccessSettings", "AllAccess"],
  A9: ["AccessBulkUpload", "AllAccess"],
  A10: ["LoanApprove", "LoanRelease", "AllAccess"],
  M1: ["AccessLeave", "AllAccess"],
  M2: ["AccessAttendanceChange", "AllAccess"],
  M3: ["AccessOvertime", "AllAccess"],
  M4: ["AccessUndertime", "AllAccess"],
  M5: ["AccessScheduleAdjustment", "AllAccess"],
  M6: ["AccessLoan", "AllAccess"],
  H4: ["AccessContribution", "AllAccess"],
  C1: ["SSSContribution", "AllAccess"],
  C2: ["HDMFContribution", "AllAccess"],
  C3: ["PHICContribution", "AllAccess"],
  PR1: ["AccessPayroll", "AllAccess"],
  // R* rows mirror the Reports accordion in the Blazor `HRIS_Header.razor`.
  // R4 (Payroll Report) is granted by AccessReports OR AllAccess at the menu
  // level; the page itself further gates on `PayrollReport | AllAccess`.
  R1: ["AccessReports", "AllAccess"],
  R2: ["AccessReports", "AllAccess"],
  R3: ["AccessReports", "AllAccess"],
  R4: ["AccessReports", "AllAccess"],
  R5: ["AccessReports", "AllAccess"],
  R6: ["AccessReports", "AllAccess"],
  R7: ["AccessReports", "AllAccess"],
};

const ROUTE_TO_PERMISSION_NAMES: Record<string, PermissionName[]> = {
  requestLeave: ["AccessLeave", "AllAccess"],
  requestAttendanceChange: ["AccessAttendanceChange", "AllAccess"],
  requestOvertime: ["AccessOvertime", "AllAccess"],
  requestUndertime: ["AccessUndertime", "AllAccess"],
  requestScheduleChange: ["AccessScheduleAdjustment", "AllAccess"],
  requestLoan: ["AccessLoan", "AllAccess"],
  adminRolesPermissions: ["AdministrationRolesAndPermissions", "AllAccess"],
  apiLeave: ["AccessLeave", "AllAccess"],
  apiAttendanceChange: ["AccessAttendanceChange", "AllAccess"],
  apiOvertime: ["AccessOvertime", "AllAccess"],
  apiUndertime: ["AccessUndertime", "AllAccess"],
  apiScheduleChange: ["AccessScheduleAdjustment", "AllAccess"],
  apiLoan: ["AccessLoan", "AllAccess"],
  apiRolesPermissionsRead: ["None"],
  apiRolesPermissionsWrite: ["AdministrationRolesAndPermissions", "AllAccess"],
  reportAttendance: ["AccessReports", "AllAccess"],
  reportLeave: ["AccessReports", "AllAccess"],
  reportOvertime: ["AccessReports", "AllAccess"],
  reportPayroll: ["PayrollReport", "AllAccess"],
  reportDailylog: ["AccessReports", "AllAccess"],
  apiAttendanceReport: ["AccessReports", "AllAccess"],
  apiLeaveReport: ["AccessReports", "AllAccess"],
  apiOvertimeReport: ["AccessReports", "AllAccess"],
  apiPayrollReport: ["PayrollReport", "AllAccess"],
  apiDailylogReport: ["AccessReports", "AllAccess"],
  reportUndertime: ["AccessReports", "AllAccess"],
  reportScheduleChange: ["AccessReports", "AllAccess"],
  reportCoa: ["AccessReports", "AllAccess"],
  reportBiolog: ["AccessBiolog", "AllAccess"],
  apiUndertimeReport: ["AccessReports", "AllAccess"],
  apiScheduleChangeReport: ["AccessReports", "AllAccess"],
  apiCoaReport: ["AccessReports", "AllAccess"],
  apiBiologReport: ["AccessBiolog", "AllAccess"],
  contributionSss: ["SSSContribution", "AllAccess"],
  contributionHdmf: ["HDMFContribution", "AllAccess"],
  contributionPhic: ["PHICContribution", "AllAccess"],
  apiContributionSss: ["SSSContribution", "AllAccess"],
  apiContributionHdmf: ["HDMFContribution", "AllAccess"],
  apiContributionPhic: ["PHICContribution", "AllAccess"],
  adminManageLoans: ["LoanApprove", "LoanRelease", "AllAccess"],
};

async function fetchPermissionValues() {
  const names = new Set<PermissionName>();
  Object.values(MENU_TO_PERMISSION_NAMES).forEach((vals) => vals.forEach((v) => names.add(v)));
  Object.values(ROUTE_TO_PERMISSION_NAMES).forEach((vals) => vals.forEach((v) => names.add(v)));

  const rows = await prisma.accpermission.findMany({
    where: { per_name: { in: Array.from(names) } },
    select: { per_name: true, per_value: true },
  });

  const dbMap = new Map<string, bigint>();
  for (const row of rows) {
    if (!row.per_name || row.per_value === null || row.per_value === undefined) continue;
    dbMap.set(row.per_name, BigInt(row.per_value.toString()));
  }
  return dbMap;
}

function resolvePermissionMask(values: PermissionName[], dbMap: Map<string, bigint>): bigint {
  const masks = values.map((permissionName) => dbMap.get(permissionName) ?? PERMISSIONS[permissionName]);
  return combinePermissions(...masks);
}

async function buildCache(): Promise<PermissionCache> {
  const dbMap = await fetchPermissionValues();

  const menuPermissions: PermissionMap = {};
  for (const [menuId, names] of Object.entries(MENU_TO_PERMISSION_NAMES)) {
    menuPermissions[menuId] = resolvePermissionMask(names, dbMap);
  }

  const routePermissions: PermissionMap = {};
  for (const [routeKey, names] of Object.entries(ROUTE_TO_PERMISSION_NAMES)) {
    routePermissions[routeKey] = resolvePermissionMask(names, dbMap);
  }

  return {
    expiresAt: Date.now() + CACHE_TTL_MS,
    routePermissions,
    menuPermissions,
  };
}

export async function getAuthorizationConfig() {
  if (cache && cache.expiresAt > Date.now()) return cache;
  cache = await buildCache();
  return cache;
}

/**
 * Clears the in-memory authorization cache so the next request rebuilds it
 * from the database. Call after any mutation that affects `accrole`,
 * `accpermission`, or `accrolepermission` so route/menu masks reflect the
 * latest permission values.
 */
export function invalidateAuthorizationCache(): void {
  cache = null;
}

export async function getRouteRequiredMask(routeKey: string): Promise<bigint> {
  const config = await getAuthorizationConfig();
  return config.routePermissions[routeKey] ?? BIGINT_ZERO;
}

export async function getMenuRequiredMask(menuId: string): Promise<bigint> {
  const config = await getAuthorizationConfig();
  return config.menuPermissions[menuId] ?? BIGINT_ZERO;
}

export async function getRolePermissionMask(roleId: string | null | undefined): Promise<bigint> {
  if (!roleId) return BIGINT_ZERO;
  const rows = await prisma.accrolepermission.findMany({
    where: { arp_rol: roleId },
    select: { arp_per: true },
  });
  const permissionIds = rows.map((r) => r.arp_per).filter(Boolean) as string[];
  if (permissionIds.length === 0) return BIGINT_ZERO;

  const permissions = await prisma.accpermission.findMany({
    where: { per_id: { in: permissionIds } },
    select: { per_value: true },
  });

  return permissions.reduce((mask, p) => {
    if (p.per_value === null || p.per_value === undefined) return mask;
    return mask | BigInt(p.per_value.toString());
  }, BIGINT_ZERO);
}

