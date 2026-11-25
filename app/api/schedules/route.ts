import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { parsePagination, paginate } from "@/lib/pagination";
import { getDatedSchedules } from "@/lib/services/dated-schedule.service";
import { formatTimeForInput } from "@/lib/utils/time";
import {
  MAX_SCHEDULE_RANGE_DAYS,
  isIsoDate,
  rangeLength,
} from "@/lib/utils/scheduleDates";
import type {
  DatedScheduleEntry,
  EmployeeDatedScheduleRow,
  WeeklyScheduleDay,
} from "@/lib/types";

/**
 * GET /api/schedules[?from=YYYY-MM-DD&to=YYYY-MM-DD]
 *
 * Backing list for Manage Schedules. Returns active employees (paginated) plus,
 * when a range is given, each employee's dated entries between `from` and `to`:
 * the ones set here and their own approved schedule change requests. Without a
 * range `days` is empty. `weekly` is the employee's weekly schedule, which
 * attendance uses on dates with no entry. Filterable by department,
 * location, and a free-text search over id/name.
 *
 * `?idsOnly=1` returns just `{ ids: [...] }` for every employee matching the
 * current filters (no pagination). This powers the "Select all N matching"
 * button without pulling every employee's schedule.
 */
function buildWhere(searchParams: URLSearchParams) {
  const search = (searchParams.get("search") ?? "").trim();
  const dept = (searchParams.get("dept") ?? "").trim();
  const loc = (searchParams.get("loc") ?? "").trim();

  const where: Record<string, unknown> = { emp_status: 1 };
  if (dept) where.emp_dept = dept;
  if (loc) where.emp_loc = loc;
  if (search) {
    where.OR = [
      { emp_id: { contains: search } },
      { emp_first: { contains: search } },
      { emp_last: { contains: search } },
    ];
  }
  return where;
}

export async function GET(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiScheduleManagement");
  if (!auth.ok) return auth.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const where = buildWhere(searchParams);

    // "Select all matching": return just the ids for the current filter set.
    if (searchParams.get("idsOnly") === "1") {
      const rows = await prisma.employee.findMany({
        where,
        select: { emp_id: true },
        orderBy: { emp_last: "asc" },
      });
      return NextResponse.json({ ids: rows.map((r) => r.emp_id) });
    }

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const hasRange = from !== null || to !== null;
    if (hasRange && (!isIsoDate(from) || !isIsoDate(to))) {
      return NextResponse.json(
        { message: "Pick a date range." },
        { status: 400 }
      );
    }
    if (
      isIsoDate(from) &&
      isIsoDate(to) &&
      (rangeLength(from, to) === 0 ||
        rangeLength(from, to) > MAX_SCHEDULE_RANGE_DAYS)
    ) {
      return NextResponse.json(
        { message: `Pick a range of 1 to ${MAX_SCHEDULE_RANGE_DAYS} days.` },
        { status: 400 }
      );
    }

    const { page, limit, skip, take } = parsePagination(searchParams);
    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        select: {
          emp_id: true,
          emp_first: true,
          emp_last: true,
          emp_mid: true,
          emp_dept: true,
          emp_loc: true,
        },
        orderBy: { emp_last: "asc" },
        skip,
        take,
      }),
    ]);

    const empIds = employees.map((e) => e.emp_id);
    const [datedByEmp, weeklyRows, departments, locations] = await Promise.all([
      isIsoDate(from) && isIsoDate(to)
        ? getDatedSchedules(empIds, from, to)
        : Promise.resolve(new Map<string, DatedScheduleEntry[]>()),
      empIds.length
        ? prisma.schedule.findMany({ where: { sch_emp: { in: empIds } } })
        : Promise.resolve([]),
      prisma.department.findMany({ select: { dep_id: true, dep_desc: true } }),
      prisma.location.findMany({ select: { loc_id: true, loc_desc: true } }),
    ]);

    const depMap = new Map(departments.map((d) => [d.dep_id, d.dep_desc]));
    const locMap = new Map(locations.map((l) => [l.loc_id, l.loc_desc]));

    const weeklyByEmp = new Map<string, WeeklyScheduleDay[]>();
    for (const s of weeklyRows) {
      if (!s.sch_emp || !s.sch_day) continue;
      const rest = s.sch_rest === 1;
      const list = weeklyByEmp.get(s.sch_emp) ?? [];
      list.push({
        sch_day: s.sch_day.toUpperCase(),
        sch_in: formatTimeForInput(s.sch_in) ?? "",
        sch_out: formatTimeForInput(s.sch_out) ?? "",
        sch_bin: formatTimeForInput(s.sch_bin) ?? "",
        sch_bout: formatTimeForInput(s.sch_bout) ?? "",
        sch_rest: rest,
        sch_shift: s.sch_shift ?? "R",
        have_break: !rest && s.sch_break === 1,
      });
      weeklyByEmp.set(s.sch_emp, list);
    }

    const data: EmployeeDatedScheduleRow[] = employees.map((e) => ({
      emp_id: e.emp_id,
      emp_name: [e.emp_last, e.emp_first, e.emp_mid]
        .filter(Boolean)
        .join(", "),
      emp_dept: e.emp_dept,
      emp_dept_desc: e.emp_dept ? depMap.get(e.emp_dept) ?? null : null,
      emp_loc: e.emp_loc,
      emp_loc_desc: e.emp_loc ? locMap.get(e.emp_loc) ?? null : null,
      days: datedByEmp.get(e.emp_id) ?? [],
      weekly: weeklyByEmp.get(e.emp_id) ?? [],
    }));

    return NextResponse.json(paginate(data, total, page, limit));
  } catch (error) {
    console.error("Get schedules list error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
