/**
 * Query key factories for consistent cache management
 * Used with React Query for cache invalidation and prefetching
 */

export const queryKeys = {
  // Auth
  auth: {
    all: ["auth"] as const,
    session: () => [...queryKeys.auth.all, "session"] as const,
  },

  // Employees
  employees: {
    all: ["employees"] as const,
    lists: () => [...queryKeys.employees.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.employees.lists(), filters] as const,
    details: () => [...queryKeys.employees.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.employees.details(), id] as const,
  },

  // User Profile
  userProfile: {
    all: ["userProfile"] as const,
    current: () => [...queryKeys.userProfile.all, "current"] as const,
  },

  // Leave Requests
  leave: {
    all: ["leave"] as const,
    grid: () => [...queryKeys.leave.all, "grid"] as const,
    types: () => [...queryKeys.leave.all, "types"] as const,
    typesForEmployee: (empId: string) =>
      [...queryKeys.leave.all, "types", "empleave", empId] as const,
    year: () => [...queryKeys.leave.all, "year"] as const,
    summary: (id: string) => [...queryKeys.leave.all, "summary", id] as const,
    user: (empId: string) => [...queryKeys.leave.all, "user", empId] as const,
    credits: (empId: string) =>
      [...queryKeys.leave.all, "credits", empId] as const,
  },

  // Overtime Requests
  overtime: {
    all: ["overtime"] as const,
    year: () => [...queryKeys.overtime.all, "year"] as const,
    list: () => [...queryKeys.overtime.all, "list"] as const,
    detail: (id: string) => [...queryKeys.overtime.all, "detail", id] as const,
    attendance: (date: string) =>
      [...queryKeys.overtime.all, "attendance", date] as const,
  },

  // Undertime Requests
  undertime: {
    all: ["undertime"] as const,
    list: () => [...queryKeys.undertime.all, "list"] as const,
    detail: (id: string) => [...queryKeys.undertime.all, "detail", id] as const,
  },

  // Schedule Adjustment Requests
  scheduleAdjust: {
    all: ["scheduleAdjust"] as const,
    year: () => [...queryKeys.scheduleAdjust.all, "year"] as const,
    list: () => [...queryKeys.scheduleAdjust.all, "list"] as const,
    detail: (id: string) =>
      [...queryKeys.scheduleAdjust.all, "detail", id] as const,
  },

  // COA Requests
  coa: {
    all: ["coa"] as const,
    types: () => [...queryKeys.coa.all, "types"] as const,
    list: () => [...queryKeys.coa.all, "list"] as const,
    grid: () => [...queryKeys.coa.all, "grid"] as const,
    detail: (id: string) => [...queryKeys.coa.all, "detail", id] as const,
  },

  // Loan Requests
  loan: {
    all: ["loan"] as const,
    list: () => [...queryKeys.loan.all, "list"] as const,
    managementList: () => [...queryKeys.loan.all, "managementList"] as const,
    detail: (id: string) => [...queryKeys.loan.all, "detail", id] as const,
  },
};
