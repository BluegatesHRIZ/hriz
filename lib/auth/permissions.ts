const BIGINT_ZERO = BigInt(0);

export const PERMISSIONS = {
  None: BIGINT_ZERO,
  AllAccess: BigInt("1"),
  AccessLeave: BigInt("2"),
  AccessAttendanceChange: BigInt("4"),
  AccessUndertime: BigInt("8"),
  AccessOvertime: BigInt("16"),
  AccessScheduleAdjustment: BigInt("32"),
  AccessEmployee: BigInt("64"),
  CreateEmployee: BigInt("128"),
  EditEmployee: BigInt("256"),
  ManageEmployeeStatus: BigInt("512"),
  AccessAnnouncement: BigInt("1024"),
  CreateAnnouncement: BigInt("2048"),
  EditAnnouncement: BigInt("4096"),
  DeleteAnnouncement: BigInt("8192"),
  AccessHoliday: BigInt("16384"),
  CreateHoliday: BigInt("32768"),
  EditHoliday: BigInt("65536"),
  DeleteHoliday: BigInt("131072"),
  AccessMasterfile: BigInt("262144"),
  CreateMasterfile: BigInt("524288"),
  EditMasterfile: BigInt("1048576"),
  DeleteMasterfile: BigInt("2097152"),
  AccessSettings: BigInt("4194304"),
  AccessReports: BigInt("8388608"),
  ImportEmployeeOnDevice: BigInt("16777216"),
  AccessRequests: BigInt("33554432"),
  FileUpload: BigInt("67108864"),
  AdministrationRolesAndPermissions: BigInt("134217728"),
  AccessApproval: BigInt("268435456"),
  AccessBiolog: BigInt("536870912"),
  AccessNews: BigInt("1073741824"),
  AccessRequestCount: BigInt("2147483648"),
  AccessStatus: BigInt("4294967296"),
  AssignRoles: BigInt("8589934592"),
  RegisterDevice: BigInt("17179869184"),
  AccessPayroll: BigInt("34359738368"),
  ManagePayroll: BigInt("68719476736"),
  GeneratePayroll: BigInt("137438953472"),
  PostPayroll: BigInt("274877906944"),
  AccessUserPayslip: BigInt("549755813888"),
  AccessLoan: BigInt("1099511627776"),
  AccessBulkUpload: BigInt("2199023255552"),
  LoanApprove: BigInt("4398046511104"),
  LoanRelease: BigInt("8796093022208"),
  SSSContribution: BigInt("17592186044416"),
  AccessContribution: BigInt("35184372088832"),
  HDMFContribution: BigInt("70368744177664"),
  PHICContribution: BigInt("140737488355328"),
  PayrollReport: BigInt("281474976710656"),
} as const;

export type PermissionName = keyof typeof PERMISSIONS;

export function parsePermissionMask(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(value);
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      return BigInt(value.trim());
    } catch {
      return BIGINT_ZERO;
    }
  }
  return BIGINT_ZERO;
}

export function hasAnyPermission(userMask: bigint, requiredMask: bigint): boolean {
  if (requiredMask === BIGINT_ZERO) return true;
  return (userMask & requiredMask) !== BIGINT_ZERO;
}

export function hasAllPermissions(userMask: bigint, requiredMask: bigint): boolean {
  if (requiredMask === BIGINT_ZERO) return true;
  return (userMask & requiredMask) === requiredMask;
}

export function combinePermissions(...values: bigint[]): bigint {
  return values.reduce((acc, val) => acc | val, BIGINT_ZERO);
}

