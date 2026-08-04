import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { parsePagination, paginate } from "@/lib/pagination";
import { formatTimeForInput } from "@/lib/utils/time";

/**
 * GET /api/schedules
 *
 * Backing list for the Schedule Management module. Returns active employees
 * (paginated) plus each employee's current weekly schedule, filterable by
 * department, location, and a free-text search over id/name.
 *
 * `?idsOnly=1` returns just `{ ids: [...] }` for every employee matching the
 * current filters (no pagination) — this powers the "Select all N matching"
 * button without pulling every employee's full schedule.
 */
const DAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export interface ScheduleDayForm {
  sch_day: string;
  sch_in: string;
  sch_out: string;
  sch_bin: string;
  sch_bout: string;
  sch_hrs: number;
  sch_rest: boolean;
  sch_shift: string;
  have_break: boolean;
}

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

    // Single query for all schedules on this page (uses idx_schedule_emp),
    // grouped in memory — avoids an N+1 per-employee fetch.
    const [schedules, departments, locations] = await Promise.all([
      empIds.length
        ? prisma.schedule.findMany({ where: { sch_emp: { in: empIds } } })
        : Promise.resolve([]),
      prisma.department.findMany({ select: { dep_id: true, dep_desc: true } }),
      prisma.location.findMany({ select: { loc_id: true, loc_desc: true } }),
    ]);

    const depMap = new Map(departments.map((d) => [d.dep_id, d.dep_desc]));
    const locMap = new Map(locations.map((l) => [l.loc_id, l.loc_desc]));

    const schedByEmp = new Map<string, ScheduleDayForm[]>();
    for (const s of schedules) {
      if (!s.sch_emp) continue;
      const list = schedByEmp.get(s.sch_emp) ?? [];
      list.push({
        sch_day: s.sch_day ?? "",
        sch_in: formatTimeForInput(s.sch_in) ?? "",
        sch_out: formatTimeForInput(s.sch_out) ?? "",
        sch_bin: formatTimeForInput(s.sch_bin) ?? "",
        sch_bout: formatTimeForInput(s.sch_bout) ?? "",
        sch_hrs: s.sch_hrs ?? 0,
        sch_rest: s.sch_rest === 1,
        sch_shift: s.sch_shift ?? "R",
        have_break: s.sch_break === 1,
      });
      schedByEmp.set(s.sch_emp, list);
    }

    const dayRank = (d: string) => {
      const i = DAY_ORDER.indexOf(d.toUpperCase());
      return i === -1 ? 99 : i;
    };

    const data = employees.map((e) => ({
      emp_id: e.emp_id,
      emp_name: [e.emp_last, e.emp_first, e.emp_mid]
        .filter(Boolean)
        .join(", "),
      emp_dept: e.emp_dept,
      emp_dept_desc: e.emp_dept ? depMap.get(e.emp_dept) ?? null : null,
      emp_loc: e.emp_loc,
      emp_loc_desc: e.emp_loc ? locMap.get(e.emp_loc) ?? null : null,
      days: (schedByEmp.get(e.emp_id) ?? []).sort(
        (a, b) => dayRank(a.sch_day) - dayRank(b.sch_day)
      ),
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
