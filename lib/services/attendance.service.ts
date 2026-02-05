import { prisma } from "@/lib/db/prisma";

/** Output row for GET /api/biolog (get_attendance). */
export type BioGridRow = {
  att_emp: string | null;
  bio_date: Date | string | null;
  hol_name: string | null;
  bio_id: string | null;
  bio_emp: string | null;
  sch_in: Date | string | null;
  sch_out: Date | string | null;
  mtin: string | null;
  brkin: string | null;
  brkout: string | null;
  mtout: string | null;
  bio_logdate: Date | string | null;
  current_cutoff: number;
  msg: string | null;
  filed: string | null;
};

/** Output row for GET /api/biolog/team/[id] (team_get). */
export type TeamGridRow = {
  bio_id: string | null;
  bio_date: Date | string | null;
  emp_name: string | null;
  bio_emp: string | null;
  mtin: string | null;
  mtout: string | null;
  msg: string | null;
  bio_logdate: Date | string | null;
  sch_in: Date | string | null;
  sch_out: Date | string | null;
  filed: string | null;
  current_cutoff: number;
};

/**
 * Parse "HH:mm:ss" to a Date (time-only for Prisma TIME field).
 */
function timeStringToDate(timeStr: string): Date {
  const [h, m, s] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, h ?? 0, m ?? 0, s ?? 0));
}

/** Format a Date (time part) as "hh:mm AM/PM" for display (matches SP TIME_FORMAT "%h:%i %p"). */
function formatTimeAmPm(d: Date | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  const h = date.getUTCHours();
  const m = date.getUTCMinutes();
  const am = h < 12;
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

/** Get time in minutes since midnight (UTC) for comparison. */
function timeMinutes(d: Date | null): number {
  if (!d) return 0;
  const x = new Date(d);
  return x.getUTCHours() * 60 + x.getUTCMinutes() + x.getUTCSeconds() / 60;
}

/** Midpoint between two time Dates (for flex schedule). */
function midTime(schin: Date | null, schout: Date | null): Date | null {
  if (!schin || !schout) return null;
  const m = (timeMinutes(schin) + timeMinutes(schout)) / 2;
  return new Date(Date.UTC(1970, 0, 1, Math.floor(m / 60), m % 60, 0));
}

/** Same calendar day (date part only). */
function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Compare two dates (date part). */
function isSameDay(a: Date, b: Date): boolean {
  return dateOnly(a).getTime() === dateOnly(b).getTime();
}

function isBeforeDay(a: Date, b: Date): boolean {
  return dateOnly(a).getTime() < dateOnly(b).getTime();
}

function isAfterDay(a: Date, b: Date): boolean {
  return dateOnly(a).getTime() > dateOnly(b).getTime();
}

/**
 * Attendance/biolog service (Prisma-based).
 * Replaces stored procedure InsertUserAttendance (reference: sql/stored_proc.sql).
 */
export async function insertUserAttendance(params: {
  bioId: string;
  bioEmp: string;
  bioDate: string;
  bioType: string;
  bioTime: string;
  forYesterday: boolean;
  ipAddress: string;
  location: string;
  local: string;
}) {
  const now = new Date();
  const today = dateOnly(now); // CURDATE()

  // Settings: grace period and min in
  const settings = await prisma.settings_tab.findUnique({
    where: { set_id: "BGC" },
    select: { set_graceperiod: true, set_minin: true },
  });
  const gpMinutes =
    settings?.set_graceperiod !== undefined && settings?.set_graceperiod !== null
      ? Number(settings.set_graceperiod)
      : 0;
  const minInMinutes =
    settings?.set_minin !== undefined && settings?.set_minin !== null
      ? Number(settings.set_minin)
      : 0;

  const bioDate = new Date(params.bioDate);
  let finalDate = dateOnly(bioDate);
  if (params.forYesterday) {
    finalDate = new Date(finalDate);
    finalDate.setDate(finalDate.getDate() - 1);
  }

  // Parse bioTime (HH:mm:ss)
  const [h, m, s] = params.bioTime.split(":").map(Number);
  const bioTime = new Date(finalDate);
  bioTime.setHours(h ?? 0, m ?? 0, s ?? 0, 0);

  // Adjust for grace period if clocking in
  let finalDateTime = bioTime;
  if (params.bioType === "I" && gpMinutes > 0) {
    finalDateTime = new Date(bioTime);
    finalDateTime.setMinutes(finalDateTime.getMinutes() - gpMinutes);
  }

  // Check for holiday
  const holiday = await prisma.holiday.findFirst({
    where: {
      hol_date: finalDate,
      hol_status: 1,
      hol_location: params.local,
    },
  });
  const holtype = holiday
    ? holiday.hol_type === "Legal Holiday"
      ? "Y1"
      : holiday.hol_type === "Special Non-Working Holiday"
      ? "Y2"
      : "Y3"
    : "N";

  // Generate bio_id: COUNT existing + 1
  const count = await prisma.biologs.count({
    where: {
      bio_emp: params.bioEmp,
      bio_date: finalDate,
      bio_type: params.bioType,
    },
  });
  const bio_id = `${params.bioId}${count + 1}`;

  // Insert biolog
  await prisma.biologs.create({
    data: {
      bio_id,
      bio_emp: params.bioEmp,
      bio_date: finalDate,
      bio_type: params.bioType,
      bio_time: finalDateTime,
      bio_logdate: now,
      bio_ip: params.ipAddress,
      bio_loc: params.location,
    },
  });

  // Update attendance table
  if (params.bioType === "I") {
    await prisma.attendance.updateMany({
      where: {
        att_date: finalDate,
        att_emp: params.bioEmp,
        att_bioin: null,
        att_paycode: null,
      },
      data: {
        att_bioin: finalDateTime,
        att_holiday: holtype,
        att_local: params.local,
      },
    });
  } else if (params.bioType === "O") {
    await prisma.attendance.updateMany({
      where: {
        att_date: finalDate,
        att_emp: params.bioEmp,
        att_paycode: null,
      },
      data: {
        att_bioout: finalDateTime,
      },
    });
  } else if (params.bioType === "BI") {
    await prisma.attendance.updateMany({
      where: {
        att_date: finalDate,
        att_emp: params.bioEmp,
        att_paycode: null,
      },
      data: {
        att_brkin: finalDateTime,
      },
    });
  } else if (params.bioType === "BO") {
    await prisma.attendance.updateMany({
      where: {
        att_date: finalDate,
        att_emp: params.bioEmp,
        att_paycode: null,
      },
      data: {
        att_brkout: finalDateTime,
      },
    });
  }
}

/**
 * Get biolog/attendance grid for an employee.
 * Native Prisma + TypeScript conversion of get_attendance (sql/stored_proc.sql).
 * No raw SQL: fetches attendance, holiday, leave, COA, undertime via Prisma and computes msg/filed in JS.
 */
export async function getAttendance(empId: string): Promise<BioGridRow[]> {
  const today = dateOnly(new Date());
  const todayTime = today.getTime();
  const dayOfMonth = today.getDate();
  const isFirstHalf = dayOfMonth <= 15;

  const year = today.getFullYear();
  const month = today.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  // Settings: flex
  const settings = await prisma.settings_tab.findUnique({
    where: { set_id: "BGC" },
    select: { set_flex: true },
  });
  const flexSet = settings?.set_flex === 1;

  // Previous cutoff date range: MONTH(@today - INTERVAL 15 DAY)
  // If today is Feb 5 (first half), @today - 15 days = Jan 21, so previous cutoff is January
  // If today is Feb 20 (second half), @today - 15 days = Feb 5, so previous cutoff is February (first half)
  const fifteenDaysAgo = new Date(today);
  fifteenDaysAgo.setDate(today.getDate() - 15);
  const prevCutoffYear = fifteenDaysAgo.getFullYear();
  const prevCutoffMonth = fifteenDaysAgo.getMonth();
  const prevCutoffFirst = new Date(prevCutoffYear, prevCutoffMonth, 1);
  const prevCutoffLast = new Date(prevCutoffYear, prevCutoffMonth + 1, 0);

  const prevMonth = new Date(year, month - 1, 1);
  const prevLast = new Date(year, month, 0);

  const [
    attCurrent,
    attPrevCutoff,
    holidays,
    leaveApproved,
    leavePending,
    coaApprovedRows,
    coaPendingDates,
    undertimeApproved,
    undertimePending,
  ] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        att_emp: empId,
        att_date: { gte: firstOfMonth, lte: lastOfMonth },
      },
      orderBy: { att_date: "asc" },
    }),
    // Previous cutoff: query dates from MONTH(@today - INTERVAL 15 DAY)
    prisma.attendance.findMany({
      where: {
        att_emp: empId,
        att_date: { gte: prevCutoffFirst, lte: prevCutoffLast },
      },
      orderBy: { att_date: "asc" },
    }),
    prisma.holiday.findMany({
      where: { hol_status: 1 },
      select: { hol_date: true, hol_name: true },
    }),
    prisma.leave_summary.findMany({
      where: { lea_semp: empId, lea_sstatus: 1 },
    }),
    prisma.leave_summary.findMany({
      where: { lea_semp: empId, lea_sstatus: 0 },
    }),
    getCoaInOut(empId),
    getCoaPendingDates(empId),
    prisma.undertime.findMany({
      where: { utm_emp: empId, utm_status: 1 },
      select: { utm_date: true },
    }),
    prisma.undertime.findMany({
      where: { utm_emp: empId, utm_status: 0 },
      select: { utm_date: true },
    }),
  ]);

  const holidayByDate = new Map<number, string>();
  for (const h of holidays) {
    if (h.hol_date)
      holidayByDate.set(dateOnly(h.hol_date).getTime(), h.hol_name ?? "");
  }

  // Fetch leave_detail for approved and pending leaves (schema has no relation)
  const leaveIds = [
    ...leaveApproved.map((l) => l.lea_sid),
    ...leavePending.map((l) => l.lea_sid),
  ];
  const leaveDetails =
    leaveIds.length > 0
      ? await prisma.leave_detail.findMany({
          where: { lea_dpk: { in: leaveIds } },
        })
      : [];
  const detailsByPk = new Map<string, typeof leaveDetails>();
  for (const ld of leaveDetails) {
    const list = detailsByPk.get(ld.lea_dpk) ?? [];
    list.push(ld);
    detailsByPk.set(ld.lea_dpk, list);
  }
  const leaveApprovedWithDetails = leaveApproved.map((l) => ({
    lea_sfrom: l.lea_sfrom,
    lea_sto: l.lea_sto,
    leave_detail: (detailsByPk.get(l.lea_sid) ?? []).map((d) => ({
      lea_ddate: d.lea_ddate,
      lea_dtype: d.lea_dtype,
      lea_dampm: d.lea_dampm,
    })),
  }));
  const leavePendingWithDetails = leavePending.map((l) => ({
    lea_sfrom: l.lea_sfrom,
    lea_sto: l.lea_sto,
    leave_detail: (detailsByPk.get(l.lea_sid) ?? []).map((d) => ({
      lea_ddate: d.lea_ddate,
      lea_dtype: d.lea_dtype,
      lea_dampm: d.lea_dampm,
    })),
  }));

  const leaveApprovedByDate = buildLeaveByDate(leaveApprovedWithDetails);
  const leavePendingByDate = buildLeaveByDate(leavePendingWithDetails);
  const coaByDate = new Map<
    number,
    { coa_in: Date | null; coa_out: Date | null }
  >();
  for (const r of coaApprovedRows) {
    const t = dateOnly(r.coa_ddate!).getTime();
    if (!coaByDate.has(t)) coaByDate.set(t, { coa_in: null, coa_out: null });
    const cur = coaByDate.get(t)!;
    if (r.coa_dtype === "I" && r.coa_dtime) cur.coa_in = r.coa_dtime;
    if (r.coa_dtype === "O" && r.coa_dtime) cur.coa_out = r.coa_dtime;
  }
  const coaPendingSet = new Set(
    coaPendingDates.map((d) => dateOnly(d).getTime()),
  );
  const undertimeApprovedSet = new Set(
    undertimeApproved
      .map((u) => u.utm_date && dateOnly(u.utm_date).getTime())
      .filter(Boolean) as number[],
  );
  const undertimePendingSet = new Set(
    undertimePending
      .map((u) => u.utm_date && dateOnly(u.utm_date).getTime())
      .filter(Boolean) as number[],
  );

  const rows: BioGridRow[] = [];

  // Current cutoff: this month, filter by first/second half
  const currentCutoffAtt = attCurrent.filter((a) => {
    const d = dateOnly(a.att_date);
    const day = d.getDate();
    if (isFirstHalf) return d.getTime() <= todayTime;
    return day > 15 && d.getTime() <= todayTime;
  });
  for (const att of currentCutoffAtt) {
    const row = buildRow(
      att,
      1,
      today,
      flexSet,
      holidayByDate,
      leaveApprovedByDate,
      leavePendingByDate,
      coaByDate,
      coaPendingSet,
      undertimeApprovedSet,
      undertimePendingSet,
    );
    if (row) rows.push(row);
  }

  // Previous cutoff: dates from MONTH(@today - INTERVAL 15 DAY)
  // SP filters by: IF (@is_first_half = 1, DAYOFMONTH(date_field) > 15, DAYOFMONTH(date_field) <= 15)
  // Then filters results: msg IS NOT NULL AND msg != "Rest Day" AND msg != "Leave Approved" AND msg != "" AND msg != "Attendance Changed" AND msg != "Undertime Approved" AND hol_name IS NULL
  const prevCutoffAtt = attPrevCutoff.filter((a) => {
    const day = dateOnly(a.att_date).getDate();
    if (isFirstHalf) {
      // If first half of current month, previous cutoff is days > 15 of previous cutoff month
      return day > 15;
    } else {
      // If second half of current month, previous cutoff is days <= 15 of previous cutoff month
      return day <= 15;
    }
  });

  for (const att of prevCutoffAtt) {
    const row = buildRow(
      att,
      0,
      today,
      flexSet,
      holidayByDate,
      leaveApprovedByDate,
      leavePendingByDate,
      coaByDate,
      coaPendingSet,
      undertimeApprovedSet,
      undertimePendingSet,
    );
    if (!row) continue;
    // Mirror SP filter for prev_cutoff
    if (
      row.msg &&
      row.msg !== "Rest Day" &&
      row.msg !== "Leave Approved" &&
      row.msg !== "" &&
      row.msg !== "Attendance Changed" &&
      row.msg !== "Undertime Approved" &&
      !row.hol_name
    ) {
      rows.push(row);
    }
  }

  rows.sort((a, b) => {
    const da =
      a.bio_date instanceof Date
        ? a.bio_date.getTime()
        : new Date(a.bio_date!).getTime();
    const db =
      b.bio_date instanceof Date
        ? b.bio_date.getTime()
        : new Date(b.bio_date!).getTime();
    return db - da;
  });
  return rows;
}

/**
 * Get team attendance for today.
 * Mirrors team_get stored procedure exactly.
 * Returns attendance for team members based on employee type and supervisor hierarchy.
 */
export async function getTeamAttendance(empId: string): Promise<TeamGridRow[]> {
  const today = dateOnly(new Date());
  const todayTime = today.getTime();

  // Get employee info: emp_type, emp_supervisor, emp_dept, emp_loc
  const empWork = await prisma.empwork.findFirst({
    where: { emp_id: empId },
    select: {
      emp_type: true,
      emp_supervisor: true,
    },
  });
  const employee = await prisma.employee.findFirst({
    where: { emp_id: empId },
    select: {
      emp_dept: true,
      emp_loc: true,
    },
  });

  if (!empWork || !employee) return [];

  const myType = empWork.emp_type ?? 0;
  const team = empWork.emp_supervisor ?? "";
  const myDept = employee.emp_dept ?? "";
  const myLoc = employee.emp_loc ?? "";

  // Settings: flex
  const settings = await prisma.settings_tab.findUnique({
    where: { set_id: "BGC" },
    select: { set_flex: true },
  });
  const flexSet = settings?.set_flex === 1;

  // Filter team members based on emp_type (mirrors SP CASE logic)
  // First get all empwork records that match criteria
  let empworkWhere: any = {};

  if (myType === 1) {
    empworkWhere = {
      emp_type: { lte: 1 },
      emp_supervisor: team,
    };
  } else if (myType === 2) {
    empworkWhere = {
      OR: [
        {
          emp_type: { lte: 2 },
          emp_supervisor: empId,
        },
        {
          emp_id: empId,
        },
      ],
    };
  } else if (myType === 3) {
    empworkWhere = {
      OR: [
        {
          emp_supervisor: empId,
        },
        {
          emp_type: 3,
        },
      ],
    };
  } else if (myType === 4) {
    empworkWhere = {
      emp_type: 3,
    };
  } else {
    return [];
  }

  // Get empwork records matching criteria
  const teamEmpwork = await prisma.empwork.findMany({
    where: empworkWhere,
    select: { emp_id: true },
  });

  if (teamEmpwork.length === 0) return [];

  const teamEmpIds = teamEmpwork.map((ew) => ew.emp_id);

  // Get employee records with additional filters (emp_status, emp_role, emp_dept, emp_loc)
  const teamMembers = await prisma.employee.findMany({
    where: {
      emp_id: { in: teamEmpIds },
      emp_status: 1,
      emp_role: { not: "SUPERADMIN" },
      ...(myType === 1
        ? {
            emp_dept: myDept,
            emp_loc: myLoc,
          }
        : {}),
    },
  });

  if (teamMembers.length === 0) return [];

  const finalTeamEmpIds = teamMembers.map((tm) => tm.emp_id);

  // Get today's attendance for team members
  const [
    teamAttendance,
    holidays,
    leaveApproved,
    leavePending,
    coaApprovedRows,
    coaPendingDates,
    undertimeApproved,
    undertimePending,
  ] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        att_emp: { in: finalTeamEmpIds },
        att_date: today,
      },
    }),
    prisma.holiday.findMany({
      where: { hol_status: 1 },
      select: { hol_date: true, hol_name: true },
    }),
    prisma.leave_summary.findMany({
      where: {
        lea_semp: { in: finalTeamEmpIds },
        lea_sstatus: 1,
        OR: [
          { lea_sfrom: { lte: today } },
          { lea_sto: { gte: today } },
        ],
      },
    }),
    prisma.leave_summary.findMany({
      where: {
        lea_semp: { in: finalTeamEmpIds },
        lea_sstatus: 0,
        OR: [
          { lea_sfrom: { lte: today } },
          { lea_sto: { gte: today } },
        ],
      },
    }),
    getCoaInOutForTeam(finalTeamEmpIds, today),
    getCoaPendingDatesForTeam(finalTeamEmpIds, today),
    prisma.undertime.findMany({
      where: {
        utm_emp: { in: finalTeamEmpIds },
        utm_status: 1,
        utm_date: today,
      },
      select: { utm_date: true, utm_emp: true },
    }),
    prisma.undertime.findMany({
      where: {
        utm_emp: { in: finalTeamEmpIds },
        utm_status: 0,
        utm_date: today,
      },
      select: { utm_date: true, utm_emp: true },
    }),
  ]);

  // Build maps for lookups
  const holidayByDate = new Map<number, string>();
  for (const h of holidays) {
    if (h.hol_date)
      holidayByDate.set(dateOnly(h.hol_date).getTime(), h.hol_name ?? "");
  }

  const leaveDetails =
    leaveApproved.length > 0 || leavePending.length > 0
      ? await prisma.leave_detail.findMany({
          where: {
            lea_dpk: {
              in: [
                ...leaveApproved.map((l) => l.lea_sid),
                ...leavePending.map((l) => l.lea_sid),
              ],
            },
            lea_ddate: today,
          },
        })
      : [];

  const leaveApprovedByEmpDate = new Map<string, Array<{
    lea_ddate: Date | null;
    lea_dtype: string | null;
    lea_dampm: string | null;
  }>>();
  for (const ld of leaveDetails) {
    const leave = leaveApproved.find((l) => l.lea_sid === ld.lea_dpk);
    if (leave) {
      const key = `${leave.lea_semp}-${dateOnly(ld.lea_ddate!).getTime()}`;
      if (!leaveApprovedByEmpDate.has(key))
        leaveApprovedByEmpDate.set(key, []);
      leaveApprovedByEmpDate.get(key)!.push({
        lea_ddate: ld.lea_ddate,
        lea_dtype: ld.lea_dtype,
        lea_dampm: ld.lea_dampm,
      });
    }
  }

  const leavePendingByEmpDate = new Map<string, Array<{
    lea_ddate: Date | null;
    lea_dtype: string | null;
    lea_dampm: string | null;
  }>>();
  for (const ld of leaveDetails) {
    const leave = leavePending.find((l) => l.lea_sid === ld.lea_dpk);
    if (leave) {
      const key = `${leave.lea_semp}-${dateOnly(ld.lea_ddate!).getTime()}`;
      if (!leavePendingByEmpDate.has(key))
        leavePendingByEmpDate.set(key, []);
      leavePendingByEmpDate.get(key)!.push({
        lea_ddate: ld.lea_ddate,
        lea_dtype: ld.lea_dtype,
        lea_dampm: ld.lea_dampm,
      });
    }
  }

  const coaByEmpDate = new Map<
    string,
    { coa_in: Date | null; coa_out: Date | null }
  >();
  for (const r of coaApprovedRows) {
    const key = `${r.coa_semp}-${dateOnly(r.coa_ddate!).getTime()}`;
    if (!coaByEmpDate.has(key))
      coaByEmpDate.set(key, { coa_in: null, coa_out: null });
    const cur = coaByEmpDate.get(key)!;
    if (r.coa_dtype === "I" && r.coa_dtime) cur.coa_in = r.coa_dtime;
    if (r.coa_dtype === "O" && r.coa_dtime) cur.coa_out = r.coa_dtime;
  }

  const coaPendingSet = new Set(
    coaPendingDates.map((d) => `${d.coa_semp}-${dateOnly(d.coa_ddate!).getTime()}`),
  );

  const undertimeApprovedSet = new Set(
    undertimeApproved.map((u) => `${u.utm_emp}-${dateOnly(u.utm_date!).getTime()}`),
  );

  const undertimePendingSet = new Set(
    undertimePending.map((u) => `${u.utm_emp}-${dateOnly(u.utm_date!).getTime()}`),
  );

  // Build employee name map
  const empNameMap = new Map<string, string>();
  for (const tm of teamMembers) {
    const lastName = tm.emp_last ?? "";
    const firstName = tm.emp_first ?? "";
    const firstInitial = firstName ? firstName.charAt(0) : "";
    empNameMap.set(tm.emp_id, `${lastName},${firstInitial}`);
  }

  const rows: TeamGridRow[] = [];

  // For each team member, get or create attendance record for today
  for (const teamMember of teamMembers) {
    const att = teamAttendance.find((a) => a.att_emp === teamMember.emp_id);
    if (!att) {
      // Create a placeholder attendance record for today if it doesn't exist
      // (SP generates calendar dates, so we need to handle missing records)
      const attRow: AttRow = {
        att_date: today,
        att_emp: teamMember.emp_id,
        att_schin: null,
        att_schout: null,
        att_schbin: null,
        att_schbout: null,
        att_schhrs: null,
        att_schshift: null,
        att_restday: null,
        att_holiday: null,
        att_bioin: null,
        att_bioout: null,
        att_logdate: null,
        att_brkin: null,
        att_brkout: null,
        att_reqschin: null,
        att_reqschout: null,
        att_reqschhrs: null,
        att_reqschshift: null,
      };
      const row = buildTeamRow(
        attRow,
        today,
        flexSet,
        holidayByDate,
        leaveApprovedByEmpDate,
        leavePendingByEmpDate,
        coaByEmpDate,
        coaPendingSet,
        undertimeApprovedSet,
        undertimePendingSet,
        empNameMap.get(teamMember.emp_id) ?? "",
      );
      if (row) rows.push(row);
      continue;
    }

    const row = buildTeamRow(
      att,
      today,
      flexSet,
      holidayByDate,
      leaveApprovedByEmpDate,
      leavePendingByEmpDate,
      coaByEmpDate,
      coaPendingSet,
      undertimeApprovedSet,
      undertimePendingSet,
      empNameMap.get(teamMember.emp_id) ?? "",
    );
    if (row) rows.push(row);
  }

  return rows;
}

async function getCoaInOut(empId: string): Promise<
  Array<{
    coa_ddate: Date | null;
    coa_dtype: string | null;
    coa_dtime: Date | null;
  }>
> {
  const summaries = await prisma.coa_summary.findMany({
    where: { coa_semp: empId, coa_sstatus: 1 },
    select: { coa_sid: true },
  });
  const ids = summaries.map((s) => s.coa_sid);
  const details = await prisma.coa_detail.findMany({
    where: { coa_dpk: { in: ids } },
    select: {
      coa_dpk: true,
      coa_ddate: true,
      coa_dtype: true,
      coa_dtime: true,
    },
  });
  return details;
}

async function getCoaInOutForTeam(
  empIds: string[],
  date: Date
): Promise<
  Array<{
    coa_ddate: Date | null;
    coa_dtype: string | null;
    coa_dtime: Date | null;
    coa_semp: string | null;
  }>
> {
  const summaries = await prisma.coa_summary.findMany({
    where: { coa_semp: { in: empIds }, coa_sstatus: 1 },
    select: { coa_sid: true, coa_semp: true },
  });
  const ids = summaries.map((s) => s.coa_sid);
  const details = await prisma.coa_detail.findMany({
    where: {
      coa_dpk: { in: ids },
      coa_ddate: date,
    },
    select: {
      coa_dpk: true,
      coa_ddate: true,
      coa_dtype: true,
      coa_dtime: true,
    },
  });
  // Map details to include coa_semp
  return details.map((d) => {
    const summary = summaries.find((s) => s.coa_sid === d.coa_dpk);
    return {
      ...d,
      coa_semp: summary?.coa_semp ?? null,
    };
  });
}

async function getCoaPendingDates(empId: string): Promise<Date[]> {
  const summaries = await prisma.coa_summary.findMany({
    where: { coa_semp: empId, coa_sstatus: 0 },
    select: { coa_sid: true },
  });
  const ids = summaries.map((s) => s.coa_sid);
  const details = await prisma.coa_detail.findMany({
    where: { coa_dpk: { in: ids } },
    select: { coa_ddate: true },
  });
  return details.map((d) => d.coa_ddate!).filter(Boolean);
}

async function getCoaPendingDatesForTeam(
  empIds: string[],
  date: Date
): Promise<
  Array<{
    coa_ddate: Date | null;
    coa_semp: string | null;
  }>
> {
  const summaries = await prisma.coa_summary.findMany({
    where: { coa_semp: { in: empIds }, coa_sstatus: 0 },
    select: { coa_sid: true, coa_semp: true },
  });
  const ids = summaries.map((s) => s.coa_sid);
  const details = await prisma.coa_detail.findMany({
    where: {
      coa_dpk: { in: ids },
      coa_ddate: date,
    },
    select: {
      coa_dpk: true,
      coa_ddate: true,
    },
  });
  return details.map((d) => {
    const summary = summaries.find((s) => s.coa_sid === d.coa_dpk);
    return {
      coa_ddate: d.coa_ddate,
      coa_semp: summary?.coa_semp ?? null,
    };
  });
}

function buildLeaveByDate(
  leaveList: Array<{
    lea_sfrom: Date | null;
    lea_sto: Date | null;
    leave_detail: Array<{
      lea_ddate: Date | null;
      lea_dtype: string | null;
      lea_dampm: string | null;
    }>;
  }>,
): Map<
  number,
  { lea_sfrom: Date; lea_sto: Date; lea_dtype: string; lea_dampm: string }[]
> {
  const byDate = new Map<
    number,
    { lea_sfrom: Date; lea_sto: Date; lea_dtype: string; lea_dampm: string }[]
  >();
  for (const ls of leaveList) {
    const from = ls.lea_sfrom ? dateOnly(ls.lea_sfrom) : null;
    const to = ls.lea_sto ? dateOnly(ls.lea_sto) : null;
    if (!from || !to) continue;
    for (const ld of ls.leave_detail) {
      if (!ld.lea_ddate) continue;
      const t = dateOnly(ld.lea_ddate).getTime();
      if (!byDate.has(t)) byDate.set(t, []);
      byDate.get(t)!.push({
        lea_sfrom: from,
        lea_sto: to,
        lea_dtype: ld.lea_dtype ?? "",
        lea_dampm: ld.lea_dampm ?? "",
      });
    }
  }
  return byDate;
}

type AttRow = {
  att_date: Date;
  att_emp: string;
  att_schin: Date | null;
  att_schout: Date | null;
  att_schbin: Date | null;
  att_schbout: Date | null;
  att_schhrs: Date | null;
  att_schshift: string | null;
  att_restday: string | null;
  att_holiday: string | null;
  att_bioin: Date | null;
  att_bioout: Date | null;
  att_logdate: Date | null;
  att_brkin: Date | null;
  att_brkout: Date | null;
  att_reqschin: Date | null;
  att_reqschout: Date | null;
  att_reqschhrs: Date | null;
  att_reqschshift: string | null;
};

function buildRow(
  att: AttRow,
  currentCutoff: number,
  today: Date,
  flexSet: boolean,
  holidayByDate: Map<number, string>,
  leaveApprovedByDate: Map<
    number,
    { lea_sfrom: Date; lea_sto: Date; lea_dtype: string; lea_dampm: string }[]
  >,
  leavePendingByDate: Map<
    number,
    { lea_sfrom: Date; lea_sto: Date; lea_dtype: string; lea_dampm: string }[]
  >,
  coaByDate: Map<number, { coa_in: Date | null; coa_out: Date | null }>,
  coaPendingSet: Set<number>,
  undertimeApprovedSet: Set<number>,
  undertimePendingSet: Set<number>,
): BioGridRow | null {
  const attDate = dateOnly(att.att_date);
  const attDateTime = attDate.getTime();
  const sch_in = att.att_reqschin ?? att.att_schin;
  const sch_out = att.att_reqschout ?? att.att_schout;
  const sch_hrs = att.att_reqschhrs ?? att.att_schhrs;
  const sch_shift = att.att_reqschshift ?? att.att_schshift ?? "";
  const restday = att.att_restday === "1";
  const hol_name = holidayByDate.get(attDateTime) ?? null;
  const coa = coaByDate.get(attDateTime);
  const coa_in = coa?.coa_in ?? null;
  const coa_out = coa?.coa_out ?? null;
  const leas = leaveApprovedByDate.get(attDateTime) ?? [];
  const fleas = leavePendingByDate.get(attDateTime) ?? [];
  const onLeave = leas.length > 0;
  const onLeavePending = fleas.length > 0;
  const hasCoa = coaByDate.has(attDateTime);
  const hasCoaPending = coaPendingSet.has(attDateTime);
  const undersDate = undertimeApprovedSet.has(attDateTime);
  const fundersDate = undertimePendingSet.has(attDateTime);

  const mtin = coa_in ? formatTimeAmPm(coa_in) : formatTimeAmPm(att.att_bioin);
  const mtout = coa_out
    ? formatTimeAmPm(coa_out)
    : formatTimeAmPm(att.att_bioout);
  const mid = midTime(sch_in, sch_out);
  const now = new Date();
  const isPrevCutoff = currentCutoff === 0;
  const isTodayOrAfter = isPrevCutoff
    ? !isBeforeDay(attDate, today)
    : isAfterDay(today, attDate);

  let msg: string = "";
  if (hol_name != null && hol_name !== "") msg = hol_name;
  else if (restday) msg = "Rest Day";
  else if (sch_shift === "E") msg = "";
  else if (
    !att.att_bioin &&
    sch_in != null &&
    now < sch_in &&
    !att.att_bioout &&
    isSameDay(today, attDate) &&
    currentCutoff === 1
  )
    msg = `Expected in ${formatTimeAmPm(sch_in) ?? ""}`;
  else if (onLeave) {
    const ld = leas[0];
    const halfDayLateBio =
      ld.lea_dtype === "H" &&
      att.att_bioin &&
      timeMinutes(att.att_bioin) > timeMinutes(mid ?? null);
    const halfDayLateCoa =
      ld.lea_dtype === "H" &&
      coa_in &&
      timeMinutes(coa_in) > timeMinutes(mid ?? null);
    const halfDayLate = halfDayLateBio || halfDayLateCoa;
    if (
      ld.lea_dtype === "H" &&
      !coa_in &&
      !att.att_bioin &&
      isBeforeDay(attDate, today)
    )
      msg = "Missing Log (No Log in)";
    else if (
      ld.lea_dtype === "H" &&
      !coa_in &&
      coa_out &&
      !att.att_bioin &&
      isSameDay(today, attDate)
    )
      msg = "Missing Log (No Log in)";
    else if (
      ld.lea_dtype === "H" &&
      !coa_out &&
      !att.att_bioout &&
      isBeforeDay(attDate, today)
    )
      msg = "Missing Log (No Log out)";
    else if (
      sch_shift === "F" &&
      flexSet &&
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "A" &&
      halfDayLate &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      sch_shift !== "F" &&
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "A" &&
      halfDayLate &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "A" &&
      sch_shift === "R" &&
      ((coa_out && timeMinutes(coa_out) < timeMinutes(sch_out)) ||
        (att.att_bioout && timeMinutes(att.att_bioout) < timeMinutes(sch_out)))
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "A" &&
      sch_shift === "F" &&
      flexSet &&
      ((coa_out && timeMinutes(coa_out) < timeMinutes(sch_out)) ||
        (att.att_bioout && timeMinutes(att.att_bioout) < timeMinutes(sch_out)))
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "A" &&
      sch_shift === "F" &&
      sch_hrs &&
      ((coa_in &&
        coa_out &&
        timeMinutes(sch_hrs) > timeMinutes(coa_out) - timeMinutes(coa_in)) ||
        (att.att_bioin &&
          att.att_bioout &&
          timeMinutes(sch_hrs) >
            timeMinutes(att.att_bioout) - timeMinutes(att.att_bioin)))
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      sch_shift === "F" &&
      flexSet &&
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "P" &&
      ((att.att_bioin && timeMinutes(att.att_bioin) > timeMinutes(sch_in)) ||
        (coa_in && timeMinutes(coa_in) > timeMinutes(sch_in))) &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      sch_shift !== "F" &&
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "P" &&
      ((att.att_bioin && timeMinutes(att.att_bioin) > timeMinutes(sch_in)) ||
        (coa_in && timeMinutes(coa_in) > timeMinutes(sch_in))) &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "P" &&
      sch_shift === "R" &&
      ((coa_out && timeMinutes(coa_out) < timeMinutes(mid!)) ||
        (att.att_bioout && timeMinutes(att.att_bioout) < timeMinutes(mid!)))
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "P" &&
      sch_shift === "F" &&
      flexSet &&
      ((coa_out && timeMinutes(coa_out) < timeMinutes(mid!)) ||
        (att.att_bioout && timeMinutes(att.att_bioout) < timeMinutes(mid!)))
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      sch_shift === "F" &&
      sch_hrs &&
      ((coa_in &&
        coa_out &&
        timeMinutes(sch_hrs) > timeMinutes(coa_out) - timeMinutes(coa_in)) ||
        (att.att_bioin &&
          att.att_bioout &&
          timeMinutes(sch_hrs) >
            timeMinutes(att.att_bioout) - timeMinutes(att.att_bioin)))
    )
      msg = undersDate ? "" : "Undertime";
    else msg = "On Leave";
  } else if (hasCoa) {
    if (!coa_in && !att.att_bioin && isBeforeDay(attDate, today))
      msg = "Missing Log (No Log in)";
    else if (!coa_in && coa_out && !att.att_bioin && isSameDay(today, attDate))
      msg = "Missing Log (No Log in)";
    else if (!coa_out && !att.att_bioout && isBeforeDay(attDate, today))
      msg = "Missing Log (No Log out)";
    else if (
      sch_shift === "F" &&
      flexSet &&
      ((coa_in && timeMinutes(coa_in) > timeMinutes(sch_in)) ||
        (att.att_bioin && timeMinutes(att.att_bioin) > timeMinutes(sch_in))) &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      sch_shift !== "F" &&
      ((coa_in && timeMinutes(coa_in) > timeMinutes(sch_in)) ||
        (att.att_bioin && timeMinutes(att.att_bioin) > timeMinutes(sch_in))) &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      sch_shift === "R" &&
      ((coa_out && timeMinutes(coa_out) < timeMinutes(sch_out)) ||
        (att.att_bioout && timeMinutes(att.att_bioout) < timeMinutes(sch_out)))
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      sch_shift === "F" &&
      flexSet &&
      ((coa_out && timeMinutes(coa_out) < timeMinutes(sch_out)) ||
        (att.att_bioout && timeMinutes(att.att_bioout) < timeMinutes(sch_out)))
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      sch_shift === "F" &&
      sch_hrs &&
      ((coa_in &&
        coa_out &&
        timeMinutes(sch_hrs) > timeMinutes(coa_out) - timeMinutes(coa_in)) ||
        (att.att_bioin &&
          att.att_bioout &&
          timeMinutes(sch_hrs) >
            timeMinutes(att.att_bioout) - timeMinutes(att.att_bioin)))
    )
      msg = undersDate ? "" : "Undertime";
    else msg = "";
  } else {
    if (!att.att_bioin && att.att_bioout && isBeforeDay(attDate, today))
      msg = "Missing Log (No Log in)";
    else if (att.att_bioin && !att.att_bioout && isBeforeDay(attDate, today))
      msg = "Missing Log (No Log out)";
    else if (
      sch_shift === "F" &&
      flexSet &&
      att.att_bioin &&
      timeMinutes(att.att_bioin) > timeMinutes(sch_in) &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      sch_shift !== "F" &&
      att.att_bioin &&
      timeMinutes(att.att_bioin) > timeMinutes(sch_in) &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      sch_shift === "R" &&
      att.att_bioout &&
      timeMinutes(att.att_bioout) < timeMinutes(sch_out)
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      sch_shift === "F" &&
      sch_out &&
      att.att_bioout &&
      timeMinutes(att.att_bioout) < timeMinutes(sch_out) &&
      flexSet
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      sch_shift === "F" &&
      sch_hrs &&
      att.att_bioin &&
      att.att_bioout &&
      timeMinutes(sch_hrs) >
        timeMinutes(att.att_bioout) - timeMinutes(att.att_bioin)
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      !att.att_bioout &&
      sch_out &&
      now > sch_out &&
      isSameDay(today, attDate)
    )
      msg = "Need to logout";
    else if (
      !att.att_bioin &&
      sch_in != null &&
      now < sch_in &&
      !att.att_bioout &&
      isSameDay(today, attDate) &&
      currentCutoff === 0
    )
      msg = `Expected in ${formatTimeAmPm(sch_in) ?? ""}`;
    else if (
      sch_shift === "F" &&
      flexSet &&
      !att.att_bioin &&
      sch_in != null &&
      now > sch_in &&
      !att.att_bioout &&
      isSameDay(today, attDate)
    )
      msg = "Running Late";
    else if (
      sch_shift !== "F" &&
      !att.att_bioin &&
      sch_in != null &&
      now > sch_in &&
      !att.att_bioout &&
      isSameDay(today, attDate)
    )
      msg = "Running Late";
    else if (isBeforeDay(attDate, today) && !att.att_bioin && !att.att_bioout)
      msg = "Absent";
  }

  let filed: "A" | "F" | "N" = "N";
  const absentOrIssue =
    (isBeforeDay(attDate, today) && !att.att_bioin && !att.att_bioout) ||
    (!att.att_bioout && isBeforeDay(attDate, today)) ||
    (!att.att_bioin && isBeforeDay(attDate, today)) ||
    (!att.att_bioin && att.att_bioout && isSameDay(today, attDate)) ||
    (sch_shift === "R" &&
      att.att_bioout &&
      timeMinutes(att.att_bioout) < timeMinutes(sch_out)) ||
    (sch_shift === "F" &&
      flexSet &&
      sch_out &&
      att.att_bioout &&
      timeMinutes(att.att_bioout) < timeMinutes(sch_out)) ||
    (sch_shift === "F" &&
      sch_hrs &&
      att.att_bioin &&
      att.att_bioout &&
      timeMinutes(sch_hrs) >
        timeMinutes(att.att_bioout) - timeMinutes(att.att_bioin));
  if (onLeave && absentOrIssue) filed = "A";
  else if (onLeavePending && absentOrIssue) filed = "F";
  else if (
    hasCoa &&
    (absentOrIssue ||
      (att.att_bioin && timeMinutes(att.att_bioin) > timeMinutes(sch_in)))
  )
    filed = "A";
  else if (
    hasCoaPending &&
    (absentOrIssue ||
      (att.att_bioin && timeMinutes(att.att_bioin) > timeMinutes(sch_in)))
  )
    filed = "F";
  else if (
    undersDate &&
    (sch_shift === "R" ||
      (sch_shift === "F" && flexSet) ||
      (sch_shift === "F" && sch_hrs))
  )
    filed = "A";
  else if (
    fundersDate &&
    (sch_shift === "R" ||
      (sch_shift === "F" && flexSet) ||
      (sch_shift === "F" && sch_hrs))
  )
    filed = "F";

  return {
    att_emp: att.att_emp,
    bio_date: att.att_date,
    hol_name,
    bio_id: `${att.att_date.toISOString().slice(0, 10)}${att.att_emp}`,
    bio_emp: att.att_emp,
    sch_in: sch_in ?? null,
    sch_out: sch_out ?? null,
    mtin,
    brkin: formatTimeAmPm(att.att_brkin),
    brkout: formatTimeAmPm(att.att_brkout),
    mtout,
    bio_logdate: att.att_logdate ?? null,
    current_cutoff: currentCutoff,
    msg: msg || null,
    filed,
  };
}

/**
 * Build team row - mirrors team_get SP logic for today's attendance.
 */
function buildTeamRow(
  att: AttRow,
  today: Date,
  flexSet: boolean,
  holidayByDate: Map<number, string>,
  leaveApprovedByEmpDate: Map<
    string,
    Array<{
      lea_ddate: Date | null;
      lea_dtype: string | null;
      lea_dampm: string | null;
    }>
  >,
  leavePendingByEmpDate: Map<
    string,
    Array<{
      lea_ddate: Date | null;
      lea_dtype: string | null;
      lea_dampm: string | null;
    }>
  >,
  coaByEmpDate: Map<string, { coa_in: Date | null; coa_out: Date | null }>,
  coaPendingSet: Set<string>,
  undertimeApprovedSet: Set<string>,
  undertimePendingSet: Set<string>,
  empName: string,
): TeamGridRow | null {
  const attDate = dateOnly(att.att_date);
  const attDateTime = attDate.getTime();
  const sch_in = att.att_reqschin ?? att.att_schin;
  const sch_out = att.att_reqschout ?? att.att_schout;
  const sch_hrs = att.att_reqschhrs ?? att.att_schhrs;
  const sch_shift = att.att_reqschshift ?? att.att_schshift ?? "";
  const restday = att.att_restday === "1";
  const hol_name = holidayByDate.get(attDateTime) ?? null;
  const coaKey = `${att.att_emp}-${attDateTime}`;
  const coa = coaByEmpDate.get(coaKey);
  const coa_in = coa?.coa_in ?? null;
  const coa_out = coa?.coa_out ?? null;
  const leaveApprovedKey = `${att.att_emp}-${attDateTime}`;
  const leas = leaveApprovedByEmpDate.get(leaveApprovedKey) ?? [];
  const fleas = leavePendingByEmpDate.get(leaveApprovedKey) ?? [];
  const onLeave = leas.length > 0;
  const hasCoa = coaByEmpDate.has(coaKey);
  const hasCoaPending = coaPendingSet.has(coaKey);
  const undersKey = `${att.att_emp}-${attDateTime}`;
  const undersDate = undertimeApprovedSet.has(undersKey);
  const fundersDate = undertimePendingSet.has(undersKey);

  const mtin = coa_in ? formatTimeAmPm(coa_in) : formatTimeAmPm(att.att_bioin);
  const mtout = coa_out
    ? formatTimeAmPm(coa_out)
    : formatTimeAmPm(att.att_bioout);
  const mid = midTime(sch_in, sch_out);
  const now = new Date();

  // Mirror SP msg logic for team_get (today only)
  let msg: string = "";
  if (att.att_holiday && att.att_holiday !== "N") {
    msg = att.att_holiday;
  } else if (restday) {
    msg = "Rest Day";
  } else if (sch_shift === "E") {
    msg = "";
  } else if (onLeave) {
    const ld = leas[0];
    if (
      ld.lea_dtype === "H" &&
      !coa_in &&
      !att.att_bioin &&
      isBeforeDay(attDate, today)
    )
      msg = "Missing Log (No Log in)";
    else if (
      ld.lea_dtype === "H" &&
      !coa_in &&
      coa_out &&
      !att.att_bioin &&
      isSameDay(today, attDate)
    )
      msg = "Missing Log (No Log in)";
    else if (
      ld.lea_dtype === "H" &&
      !coa_out &&
      !att.att_bioout &&
      isBeforeDay(attDate, today)
    )
      msg = "Missing Log (No Log out)";
    else if (
      sch_shift === "F" &&
      flexSet &&
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "A" &&
      ((att.att_bioin &&
        timeMinutes(att.att_bioin) >
          timeMinutes(mid ?? null)) ||
        (coa_in && timeMinutes(coa_in) > timeMinutes(mid ?? null))) &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      sch_shift !== "F" &&
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "A" &&
      ((att.att_bioin &&
        timeMinutes(att.att_bioin) >
          timeMinutes(mid ?? null)) ||
        (coa_in && timeMinutes(coa_in) > timeMinutes(mid ?? null))) &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "A" &&
      sch_shift === "R" &&
      ((coa_out && timeMinutes(coa_out) < timeMinutes(sch_out)) ||
        (att.att_bioout && timeMinutes(att.att_bioout) < timeMinutes(sch_out)))
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "A" &&
      sch_shift === "F" &&
      flexSet &&
      ((coa_out && timeMinutes(coa_out) < timeMinutes(sch_out)) ||
        (att.att_bioout && timeMinutes(att.att_bioout) < timeMinutes(sch_out)))
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "A" &&
      sch_shift === "F" &&
      sch_hrs &&
      ((coa_in &&
        coa_out &&
        timeMinutes(sch_hrs) >
          timeMinutes(coa_out) - timeMinutes(coa_in)) ||
        (att.att_bioin &&
          att.att_bioout &&
          timeMinutes(sch_hrs) >
            timeMinutes(att.att_bioout) - timeMinutes(att.att_bioin)))
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      sch_shift === "F" &&
      flexSet &&
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "P" &&
      ((att.att_bioin && timeMinutes(att.att_bioin) > timeMinutes(sch_in)) ||
        (coa_in && timeMinutes(coa_in) > timeMinutes(sch_in))) &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      sch_shift !== "F" &&
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "P" &&
      ((att.att_bioin && timeMinutes(att.att_bioin) > timeMinutes(sch_in)) ||
        (coa_in && timeMinutes(coa_in) > timeMinutes(sch_in))) &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "P" &&
      sch_shift === "R" &&
      ((coa_out && timeMinutes(coa_out) < timeMinutes(mid!)) ||
        (att.att_bioout && timeMinutes(att.att_bioout) < timeMinutes(mid!)))
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      ld.lea_dtype === "H" &&
      ld.lea_dampm === "P" &&
      sch_shift === "F" &&
      flexSet &&
      ((coa_out && timeMinutes(coa_out) < timeMinutes(mid!)) ||
        (att.att_bioout && timeMinutes(att.att_bioout) < timeMinutes(mid!)))
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      sch_shift === "F" &&
      sch_hrs &&
      ((coa_in &&
        coa_out &&
        timeMinutes(sch_hrs) >
          timeMinutes(coa_out) - timeMinutes(coa_in)) ||
        (att.att_bioin &&
          att.att_bioout &&
          timeMinutes(sch_hrs) >
            timeMinutes(att.att_bioout) - timeMinutes(att.att_bioin)))
    )
      msg = undersDate ? "" : "Undertime";
    else msg = "On Leave";
  } else if (hasCoa) {
    if (!coa_in && !att.att_bioin && isBeforeDay(attDate, today))
      msg = "Missing Log (No Log in)";
    else if (!coa_in && coa_out && !att.att_bioin && isSameDay(today, attDate))
      msg = "Missing Log (No Log in)";
    else if (!coa_out && !att.att_bioout && isBeforeDay(attDate, today))
      msg = "Missing Log (No Log out)";
    else if (
      sch_shift === "F" &&
      flexSet &&
      ((coa_in && timeMinutes(coa_in) > timeMinutes(sch_in)) ||
        (att.att_bioin && timeMinutes(att.att_bioin) > timeMinutes(sch_in))) &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      sch_shift !== "F" &&
      ((coa_in && timeMinutes(coa_in) > timeMinutes(sch_in)) ||
        (att.att_bioin && timeMinutes(att.att_bioin) > timeMinutes(sch_in))) &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      sch_shift === "R" &&
      ((coa_out && timeMinutes(coa_out) < timeMinutes(sch_out)) ||
        (att.att_bioout && timeMinutes(att.att_bioout) < timeMinutes(sch_out)))
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      sch_shift === "F" &&
      flexSet &&
      ((coa_out && timeMinutes(coa_out) < timeMinutes(sch_out)) ||
        (att.att_bioout && timeMinutes(att.att_bioout) < timeMinutes(sch_out)))
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      sch_shift === "F" &&
      sch_hrs &&
      ((coa_in &&
        coa_out &&
        timeMinutes(sch_hrs) >
          timeMinutes(coa_out) - timeMinutes(coa_in)) ||
        (att.att_bioin &&
          att.att_bioout &&
          timeMinutes(sch_hrs) >
            timeMinutes(att.att_bioout) - timeMinutes(att.att_bioin)))
    )
      msg = undersDate ? "" : "Undertime";
    else msg = "";
  } else {
    if (!att.att_bioin && att.att_bioout && isBeforeDay(attDate, today))
      msg = "Missing Log (No Log in)";
    else if (att.att_bioin && !att.att_bioout && isBeforeDay(attDate, today))
      msg = "Missing Log (No Log out)";
    else if (
      sch_shift === "F" &&
      flexSet &&
      att.att_bioin &&
      timeMinutes(att.att_bioin) > timeMinutes(sch_in) &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      sch_shift !== "F" &&
      att.att_bioin &&
      timeMinutes(att.att_bioin) > timeMinutes(sch_in) &&
      !isBeforeDay(attDate, today)
    )
      msg = "Late";
    else if (
      sch_shift === "R" &&
      att.att_bioout &&
      timeMinutes(att.att_bioout) < timeMinutes(sch_out)
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      sch_shift === "F" &&
      att.att_schout &&
      att.att_bioout &&
      timeMinutes(att.att_bioout) < timeMinutes(att.att_schout) &&
      flexSet
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      sch_shift === "F" &&
      att.att_schhrs &&
      att.att_bioin &&
      att.att_bioout &&
      timeMinutes(att.att_schhrs) >
        timeMinutes(att.att_bioout) - timeMinutes(att.att_bioin)
    )
      msg = undersDate ? "" : "Undertime";
    else if (
      !att.att_bioout &&
      sch_out &&
      now > sch_out &&
      isSameDay(today, attDate)
    )
      msg = "Need to logout";
    else if (
      !att.att_bioin &&
      sch_in != null &&
      now < sch_in &&
      !att.att_bioout &&
      isSameDay(today, attDate)
    )
      msg = `Expected in ${formatTimeAmPm(sch_in) ?? ""}`;
    else if (
      sch_shift === "F" &&
      flexSet &&
      !att.att_bioin &&
      sch_in != null &&
      now > sch_in &&
      !att.att_bioout &&
      isSameDay(today, attDate)
    )
      msg = "Running Late";
    else if (
      sch_shift !== "F" &&
      !att.att_bioin &&
      sch_in != null &&
      now > sch_in &&
      !att.att_bioout &&
      isSameDay(today, attDate)
    )
      msg = "Running Late";
    else if (isBeforeDay(attDate, today) && !att.att_bioin && !att.att_bioout)
      msg = "Absent";
  }

  // Mirror SP filed logic for team_get
  let filed: "A" | "F" | "N" = "N";
  const absentOrIssue =
    (isBeforeDay(attDate, today) && !att.att_bioin && !att.att_bioout) ||
    (!att.att_bioout && isBeforeDay(attDate, today)) ||
    (!att.att_bioin && isBeforeDay(attDate, today)) ||
    (!att.att_bioin && att.att_bioout && isSameDay(today, attDate)) ||
    (sch_shift === "R" &&
      att.att_bioout &&
      timeMinutes(att.att_bioout) < timeMinutes(sch_out)) ||
    (sch_shift === "F" &&
      sch_out &&
      att.att_bioout &&
      timeMinutes(att.att_bioout) < timeMinutes(sch_out)) ||
    (sch_shift === "F" &&
      sch_hrs &&
      att.att_bioin &&
      att.att_bioout &&
      timeMinutes(sch_hrs) >
        timeMinutes(att.att_bioout) - timeMinutes(att.att_bioin));

  if (onLeave && absentOrIssue) filed = "A";
  else if (
    fleas.length > 0 &&
    absentOrIssue &&
    (sch_shift === "R" ||
      (sch_shift === "F" && sch_out) ||
      (sch_shift === "F" && sch_hrs))
  )
    filed = "F";
  else if (
    hasCoa &&
    (absentOrIssue ||
      (att.att_bioin && timeMinutes(att.att_bioin) > timeMinutes(sch_in)))
  )
    filed = "A";
  else if (
    hasCoaPending &&
    (absentOrIssue ||
      (att.att_bioin && timeMinutes(att.att_bioin) > timeMinutes(sch_in)))
  )
    filed = "F";
  else if (
    undersDate &&
    (sch_shift === "R" ||
      (sch_shift === "F" && sch_out) ||
      (sch_shift === "F" && sch_hrs))
  )
    filed = "A";
  else if (
    fundersDate &&
    (sch_shift === "R" ||
      (sch_shift === "F" && sch_out) ||
      (sch_shift === "F" && sch_hrs))
  )
    filed = "F";

  return {
    bio_id: `${att.att_date.toISOString().slice(0, 10)}${att.att_emp}`,
    bio_date: att.att_date,
    emp_name: empName,
    bio_emp: att.att_emp,
    mtin,
    mtout,
    msg: msg || null,
    bio_logdate: att.att_logdate ?? null,
    sch_in: sch_in ?? null,
    sch_out: sch_out ?? null,
    filed,
    current_cutoff: 1,
  };
}
