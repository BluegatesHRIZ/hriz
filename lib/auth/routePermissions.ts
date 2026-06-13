const PAGE_ROUTE_MATCHERS: Array<{ test: RegExp; key: string }> = [
  { test: /^\/request\/leave(\/|$)/, key: "requestLeave" },
  { test: /^\/request\/attendance-change(\/|$)/, key: "requestAttendanceChange" },
  { test: /^\/request\/overtime(\/|$)/, key: "requestOvertime" },
  { test: /^\/request\/undertime(\/|$)/, key: "requestUndertime" },
  { test: /^\/request\/schedule-change(\/|$)/, key: "requestScheduleChange" },
  { test: /^\/request\/loan(\/|$)/, key: "requestLoan" },
  { test: /^\/admin\/roles-permissions(\/|$)/, key: "adminRolesPermissions" },
  { test: /^\/admin\/announcements(\/|$)/, key: "adminAnnouncements" },
  { test: /^\/admin\/holidays(\/|$)/, key: "adminHolidays" },
  { test: /^\/admin\/masterfile(\/|$)/, key: "adminMasterfile" },
  { test: /^\/admin\/register-device(\/|$)/, key: "adminRegisterDevice" },
  { test: /^\/admin\/settings(\/|$)/, key: "adminSettings" },
  { test: /^\/admin\/bulk-upload(\/|$)/, key: "adminBulkUpload" },
  { test: /^\/admin\/manage-loans(\/|$)/, key: "adminManageLoans" },
  { test: /^\/reports\/attendance(\/|$)/, key: "reportAttendance" },
  { test: /^\/reports\/leave(\/|$)/, key: "reportLeave" },
  { test: /^\/reports\/overtime(\/|$)/, key: "reportOvertime" },
  { test: /^\/reports\/payroll(\/|$)/, key: "reportPayroll" },
  { test: /^\/reports\/dailylog(\/|$)/, key: "reportDailylog" },
  { test: /^\/reports\/undertime(\/|$)/, key: "reportUndertime" },
  { test: /^\/reports\/schedule-change(\/|$)/, key: "reportScheduleChange" },
  { test: /^\/reports\/attendance-change(\/|$)/, key: "reportCoa" },
  { test: /^\/reports\/biolog(\/|$)/, key: "reportBiolog" },
  { test: /^\/contributions\/sss(\/|$)/, key: "contributionSss" },
  { test: /^\/contributions\/hdmf(\/|$)/, key: "contributionHdmf" },
  { test: /^\/contributions\/phic(\/|$)/, key: "contributionPhic" },
];

const API_ROUTE_MATCHERS: Array<{ test: RegExp; key: string }> = [
  { test: /^\/api\/leave(\/|$)/, key: "apiLeave" },
  { test: /^\/api\/coa(\/|$)/, key: "apiAttendanceChange" },
  { test: /^\/api\/overtime(\/|$)/, key: "apiOvertime" },
  { test: /^\/api\/undertime(\/|$)/, key: "apiUndertime" },
  { test: /^\/api\/schedule-adjust(\/|$)/, key: "apiScheduleChange" },
  { test: /^\/api\/loan(\/|$)/, key: "apiLoan" },
  // GETs are allowed for any authenticated user; mutation methods are checked
  // again in the route handler against `apiRolesPermissionsWrite`.
  { test: /^\/api\/roles-permissions(\/|$)/, key: "apiRolesPermissionsRead" },
  { test: /^\/api\/admin\/announcements(\/|$)/, key: "apiAdminAnnouncements" },
  { test: /^\/api\/admin\/holidays(\/|$)/, key: "apiAdminHolidays" },
  { test: /^\/api\/admin\/masterfile(\/|$)/, key: "apiAdminMasterfile" },
  { test: /^\/api\/admin\/devices(\/|$)/, key: "apiAdminDevices" },
  { test: /^\/api\/admin\/bulk-upload(\/|$)/, key: "apiAdminBulkUpload" },
  { test: /^\/api\/settings(\/|$)/, key: "apiAdminSettings" },
  { test: /^\/api\/reports\/attendance(\/|$)/, key: "apiAttendanceReport" },
  { test: /^\/api\/reports\/leave(\/|$)/, key: "apiLeaveReport" },
  { test: /^\/api\/reports\/overtime(\/|$)/, key: "apiOvertimeReport" },
  { test: /^\/api\/reports\/payroll(\/|$)/, key: "apiPayrollReport" },
  { test: /^\/api\/reports\/dailylog(\/|$)/, key: "apiDailylogReport" },
  { test: /^\/api\/reports\/undertime(\/|$)/, key: "apiUndertimeReport" },
  { test: /^\/api\/reports\/schedule-change(\/|$)/, key: "apiScheduleChangeReport" },
  { test: /^\/api\/reports\/attendance-change(\/|$)/, key: "apiCoaReport" },
  { test: /^\/api\/reports\/biolog(\/|$)/, key: "apiBiologReport" },
  { test: /^\/api\/contributions\/sss(\/|$)/, key: "apiContributionSss" },
  { test: /^\/api\/contributions\/hdmf(\/|$)/, key: "apiContributionHdmf" },
  { test: /^\/api\/contributions\/phic(\/|$)/, key: "apiContributionPhic" },
];

export function getPageRouteKey(pathname: string): string | null {
  const match = PAGE_ROUTE_MATCHERS.find((entry) => entry.test.test(pathname));
  return match?.key ?? null;
}

export function getApiRouteKey(pathname: string): string | null {
  const match = API_ROUTE_MATCHERS.find((entry) => entry.test.test(pathname));
  return match?.key ?? null;
}

