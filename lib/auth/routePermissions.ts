const PAGE_ROUTE_MATCHERS: Array<{ test: RegExp; key: string }> = [
  { test: /^\/request\/leave(\/|$)/, key: "requestLeave" },
  { test: /^\/request\/attendance-change(\/|$)/, key: "requestAttendanceChange" },
  { test: /^\/request\/overtime(\/|$)/, key: "requestOvertime" },
  { test: /^\/request\/undertime(\/|$)/, key: "requestUndertime" },
  { test: /^\/request\/schedule-change(\/|$)/, key: "requestScheduleChange" },
  { test: /^\/request\/loan(\/|$)/, key: "requestLoan" },
];

const API_ROUTE_MATCHERS: Array<{ test: RegExp; key: string }> = [
  { test: /^\/api\/leave(\/|$)/, key: "apiLeave" },
  { test: /^\/api\/coa(\/|$)/, key: "apiAttendanceChange" },
  { test: /^\/api\/overtime(\/|$)/, key: "apiOvertime" },
  { test: /^\/api\/undertime(\/|$)/, key: "apiUndertime" },
  { test: /^\/api\/schedule-adjust(\/|$)/, key: "apiScheduleChange" },
  { test: /^\/api\/loan(\/|$)/, key: "apiLoan" },
];

export function getPageRouteKey(pathname: string): string | null {
  const match = PAGE_ROUTE_MATCHERS.find((entry) => entry.test.test(pathname));
  return match?.key ?? null;
}

export function getApiRouteKey(pathname: string): string | null {
  const match = API_ROUTE_MATCHERS.find((entry) => entry.test.test(pathname));
  return match?.key ?? null;
}

