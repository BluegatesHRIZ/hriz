import { prisma } from "@/lib/db/prisma";
import { randomUUID } from "crypto";

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

/** Same calendar day (date part only) - normalized to UTC midnight to avoid timezone shifts. */
function dateOnly(d: Date): Date {
  // Use UTC to ensure the same calendar date regardless of server timezone
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
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

/** CURTIME() as time-only Date (1970-01-01 HH:mm:ss) for comparison. */
function getCurrentTimeDate(now: Date): Date {
  return new Date(1970, 0, 1, now.getHours(), now.getMinutes(), now.getSeconds());
}

/** Extract time part as Date(1970,0,1,h,m,s). */
function timeOnly(d: Date): Date {
  return new Date(1970, 0, 1, d.getHours(), d.getMinutes(), d.getSeconds());
}

/** True if time t is >= start and <= end (time parts only). */
function timeInRange(t: Date, start: Date, end: Date): boolean {
  const tm = t.getHours() * 3600 + t.getMinutes() * 60 + t.getSeconds();
  const sm = start.getHours() * 3600 + start.getMinutes() * 60 + start.getSeconds();
  const em = end.getHours() * 3600 + end.getMinutes() * 60 + end.getSeconds();
  return tm >= sm && tm <= em;
}

/**
 * make_daily(_dte): ensure attendance rows exist from latest att_date through _dte.
 * SP: CALL make_daily(curdate());
 */
async function makeDaily(_dte: Date): Promise<void> {
  const dte = dateOnly(_dte);
  const latest = await prisma.attendance.findFirst({
    orderBy: { att_date: "desc" },
    select: { att_date: true },
  });
  let current = latest?.att_date ? dateOnly(latest.att_date) : new Date(dte.getTime());
  while (current.getTime() <= dte.getTime()) {
    await ensureAttendanceForDate(current);
    current.setUTCDate(current.getUTCDate() + 1); // Use UTC to avoid timezone shifts
  }
}

async function ensureAttendanceForDate(biodate: Date): Promise<void> {
  // Use UTC date to get correct day name regardless of timezone
  const dayName = new Date(biodate.getUTCFullYear(), biodate.getUTCMonth(), biodate.getUTCDate()).toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const hiredEmpIds = await prisma.empwork.findMany({
    where: { emp_datehired: { lte: biodate } },
    select: { emp_id: true },
  });
  const empIds = hiredEmpIds.map((e) => e.emp_id);
  const employees = await prisma.employee.findMany({
    where: {
      emp_id: { in: empIds },
      emp_status: 1,
      emp_role: { not: "SUPERADMIN" },
    },
    select: { emp_id: true, emp_loc: true },
  });
  for (const emp of employees) {
    const exists = await prisma.attendance.findFirst({
      where: { att_date: biodate, att_emp: emp.emp_id },
    });
    if (exists) continue;
    const schedule = await prisma.schedule.findFirst({
      where: { sch_emp: emp.emp_id, sch_day: dayName },
    });
    const holiday = await prisma.holiday.findFirst({
      where: {
        hol_date: biodate,
        hol_status: 1,
        hol_location: emp.emp_loc ?? undefined,
      },
    });
    const holType = holiday
      ? holiday.hol_type === "Legal Holiday"
        ? "Y1"
        : holiday.hol_type === "Special Non-Working Holiday"
        ? "Y2"
        : "Y3"
      : "N";
    const schIn = schedule?.sch_in;
    const schOut = schedule?.sch_out;
    const schBin = schedule?.sch_bin;
    const schBout = schedule?.sch_bout;
    const schHrs = schedule?.sch_hrs;
    const schShift = schedule?.sch_shift;
    const schRest = schedule?.sch_rest;
    // att_schhrs = cast(floor(sch_hrs):(mod*60) as time) in SP
    const attSchhrs =
      schHrs != null
        ? new Date(1970, 0, 1, Math.floor(schHrs), Math.round((schHrs % 1) * 60), 0)
        : undefined;
    // att_schbreak = timediff(sch_bout, sch_bin) in SP
    const attSchbreak =
      schedule?.sch_bout && schedule?.sch_bin
        ? new Date(
            new Date(schedule.sch_bout).getTime() - new Date(schedule.sch_bin).getTime()
          )
        : undefined;
    const attSchin = schIn ? new Date(biodate.getFullYear(), biodate.getMonth(), biodate.getDate(), new Date(schIn).getUTCHours(), new Date(schIn).getUTCMinutes()) : null;
    const attSchout = schOut ? new Date(biodate.getFullYear(), biodate.getMonth(), biodate.getDate(), new Date(schOut).getUTCHours(), new Date(schOut).getUTCMinutes()) : null;
    const attSchbin = schBin ? new Date(biodate.getFullYear(), biodate.getMonth(), biodate.getDate(), new Date(schBin).getUTCHours(), new Date(schBin).getUTCMinutes()) : null;
    const attSchbout = schBout ? new Date(biodate.getFullYear(), biodate.getMonth(), biodate.getDate(), new Date(schBout).getUTCHours(), new Date(schBout).getUTCMinutes()) : null;
    await prisma.attendance.create({
      data: {
        att_date: biodate,
        att_emp: emp.emp_id,
        att_schin: attSchin ?? undefined,
        att_schout: attSchout ?? undefined,
        att_schbin: attSchbin ?? undefined,
        att_schbout: attSchbout ?? undefined,
        att_schhrs: attSchhrs,
        att_schshift: schShift ?? undefined,
        att_schbreak: attSchbreak,
        att_restday: schRest != null ? String(schRest) : undefined,
        att_holiday: holType,
        att_local: emp.emp_loc ?? undefined,
      },
    });
  }
}

/**
 * Ensure a single attendance row exists for (biodate, empId). Creates one if missing
 * so clock-in/out updateMany can find a row and set att_bioin/att_bioout.
 */
async function ensureAttendanceRowForPunch(biodate: Date, empId: string): Promise<void> {
  // Normalize biodate to UTC midnight for consistent comparison
  const normalizedDate = dateOnly(biodate);
  const existing = await prisma.attendance.findFirst({
    where: { att_date: normalizedDate, att_emp: empId },
  });
  if (existing) return;

  // Use UTC date to get correct day name regardless of timezone
  const dayName = new Date(normalizedDate.getUTCFullYear(), normalizedDate.getUTCMonth(), normalizedDate.getUTCDate()).toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const emp = await prisma.employee.findUnique({
    where: { emp_id: empId },
    select: { emp_loc: true },
  });
  const schedule = await prisma.schedule.findFirst({
    where: { sch_emp: empId, sch_day: dayName },
  });
  const holiday = await prisma.holiday.findFirst({
    where: {
      hol_date: normalizedDate,
      hol_status: 1,
      hol_location: emp?.emp_loc ?? undefined,
    },
  });
  const holType = holiday
    ? holiday.hol_type === "Legal Holiday"
      ? "Y1"
      : holiday.hol_type === "Special Non-Working Holiday"
      ? "Y2"
      : "Y3"
    : "N";
  const schIn = schedule?.sch_in;
  const schOut = schedule?.sch_out;
  const schBin = schedule?.sch_bin;
  const schBout = schedule?.sch_bout;
  const schHrs = schedule?.sch_hrs;
  const schShift = schedule?.sch_shift;
  const schRest = schedule?.sch_rest;
  const attSchhrs =
    schHrs != null
      ? new Date(1970, 0, 1, Math.floor(schHrs), Math.round((schHrs % 1) * 60), 0)
      : undefined;
  const attSchbreak =
    schedule?.sch_bout && schedule?.sch_bin
      ? new Date(
          new Date(schedule.sch_bout).getTime() - new Date(schedule.sch_bin).getTime()
        )
      : undefined;
  // Use UTC date components to ensure correct calendar date regardless of timezone
  const attSchin = schIn ? new Date(Date.UTC(normalizedDate.getUTCFullYear(), normalizedDate.getUTCMonth(), normalizedDate.getUTCDate(), new Date(schIn).getUTCHours(), new Date(schIn).getUTCMinutes())) : undefined;
  const attSchout = schOut ? new Date(Date.UTC(normalizedDate.getUTCFullYear(), normalizedDate.getUTCMonth(), normalizedDate.getUTCDate(), new Date(schOut).getUTCHours(), new Date(schOut).getUTCMinutes())) : undefined;
  const attSchbin = schBin ? new Date(Date.UTC(normalizedDate.getUTCFullYear(), normalizedDate.getUTCMonth(), normalizedDate.getUTCDate(), new Date(schBin).getUTCHours(), new Date(schBin).getUTCMinutes())) : undefined;
  const attSchbout = schBout ? new Date(Date.UTC(normalizedDate.getUTCFullYear(), normalizedDate.getUTCMonth(), normalizedDate.getUTCDate(), new Date(schBout).getUTCHours(), new Date(schBout).getUTCMinutes())) : undefined;

  await prisma.attendance.create({
    data: {
      att_date: normalizedDate,
      att_emp: empId,
      att_schin: attSchin,
      att_schout: attSchout,
      att_schbin: attSchbin,
      att_schbout: attSchbout,
      att_schhrs: attSchhrs,
      att_schshift: schShift ?? undefined,
      att_schbreak: attSchbreak,
      att_restday: schRest != null ? String(schRest) : undefined,
      att_holiday: holType,
      att_local: emp?.emp_loc ?? undefined,
    },
  });
}

/**
 * Attendance/biolog service (Prisma-based).
 * Exact line-by-line conversion of InsertUserAttendance (sql/stored_proc.sql).
 * SP uses CURDATE()/CURTIME() (server time) - we use server Date() for consistency.
 * Bio_id uses UUID instead of counter-based ID from SP.
 */
export async function insertUserAttendance(params: {
  bioId?: string; // Not used - UUID generated instead of SP's counter-based ID
  bioEmp: string;
  bioDate: string;
  bioType: string;
  bioTime: string;
  forYesterday: boolean;
  ipAddress: string;
  location: string;
  local: string;
}) {
  // SP: DECLARE _counter int; DECLARE _bioid VARCHAR(20);
  // SP: SET _counter = (SELECT COUNT(`bio_emp`) FROM `biologs` WHERE `bio_emp` = _bio_emp and `bio_date`= date(now())) + 1;
  // SP: SET _bioid = CONCAT(_bio_id, _counter);
  // We use UUID instead of counter-based ID
  const bio_id = randomUUID();

  // SP: CALL make_daily(curdate());
  const now = new Date(); // Server CURDATE()/CURTIME()
  const curdate = dateOnly(now); // CURDATE()
  const curtime = getCurrentTimeDate(now); // CURTIME() as time-only Date
  await makeDaily(curdate);

  // SP: SET _counter = (SELECT COUNT(`bio_emp`) FROM `biologs` WHERE `bio_emp` = _bio_emp and `bio_date`= date(now())) + 1;
  // SP: SET _bioid = CONCAT(_bio_id, _counter);
  // We skip counter and use UUID above

  // SP: SELECT set_graceperiod,set_minin INTO _gp,_minin FROM settings_tab;
  // SP has no WHERE clause - we use set_id='BGC' as fallback
  const settings = await prisma.settings_tab.findFirst({
    select: { set_graceperiod: true, set_minin: true },
  });
  const _gp = settings?.set_graceperiod ?? null; // TIME
  const _minin = settings?.set_minin ?? null; // TIME

  // SP: SELECT subtime(concat(CURDATE(),' ',time(sch_in)),_minin),concat(CURDATE(),' ',CURTIME()) INTO _in,_now
  // SP: FROM schedule WHERE sch_emp = _bio_emp AND sch_day = DAYNAME(CURDATE());
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase(); // DAYNAME(CURDATE())
  const schedule = await prisma.schedule.findFirst({
    where: { sch_emp: params.bioEmp, sch_day: dayName },
    select: { sch_in: true },
  });

  let _in: Date | null = null; // datetime: CURDATE + sch_in - _minin
  // Use UTC to ensure correct date/time representation
  const _now = new Date(Date.UTC(curdate.getUTCFullYear(), curdate.getUTCMonth(), curdate.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds())); // concat(CURDATE(),' ',CURTIME())

  if (schedule?.sch_in && _minin) {
    // subtime(concat(CURDATE(),' ',time(sch_in)),_minin)
    const schIn = new Date(schedule.sch_in);
    const schInTime = new Date(Date.UTC(curdate.getUTCFullYear(), curdate.getUTCMonth(), curdate.getUTCDate(), schIn.getUTCHours(), schIn.getUTCMinutes(), schIn.getUTCSeconds()));
    const minInMs = (_minin.getUTCHours() * 60 + _minin.getUTCMinutes()) * 60 * 1000;
    _in = new Date(schInTime.getTime() - minInMs);
  } else if (schedule?.sch_in) {
    // No _minin: concat(CURDATE(),' ',time(sch_in))
    const schIn = new Date(schedule.sch_in);
    _in = new Date(Date.UTC(curdate.getUTCFullYear(), curdate.getUTCMonth(), curdate.getUTCDate(), schIn.getUTCHours(), schIn.getUTCMinutes(), schIn.getUTCSeconds()));
  }

  // SP: SET _maxin = ADDTIME(time(_in),time(_gp));
  let _maxin: Date | null = null;
  if (_in && _gp) {
    const inTime = timeOnly(_in);
    const inMin = inTime.getHours() * 60 + inTime.getMinutes() + inTime.getSeconds() / 60;
    const gpMin = _gp.getUTCHours() * 60 + _gp.getUTCMinutes() + _gp.getUTCSeconds() / 60;
    _maxin = new Date(1970, 0, 1, 0, Math.round(inMin + gpMin), 0);
  }

  // SP: IF _bio_type = "I" THEN ... ELSEIF "O" ... ELSEIF "BO" ... ELSEIF "BI" ...
  let finalDate: Date;
  let finalTime: Date;

  if (params.bioType === "I") {
    // SP: IF _for_yesterday = 1 THEN set _finaldate=CURDATE() - INTERVAL 1 DAY; ELSE set _finaldate=CURDATE(); END IF;
    if (params.forYesterday) {
      finalDate = new Date(curdate);
      finalDate.setUTCDate(finalDate.getUTCDate() - 1); // Use UTC to avoid timezone shifts
    } else {
      finalDate = new Date(curdate);
    }
    // SP: set _finaltime=IF(CURTIME()>=time(_in) AND CURTIME()<=time(_maxin),time(_in),CURTIME());
    if (_in != null && _maxin != null && timeInRange(curtime, timeOnly(_in), _maxin)) {
      finalTime = timeOnly(_in);
    } else {
      finalTime = curtime;
    }
  } else if (params.bioType === "O") {
    // SP: IF _in < _now THEN set _finaldate=CURDATE() - INTERVAL 1 DAY; ELSE set _finaldate=CURDATE(); END IF;
    // However, the SP logic compares schedule time with current time, which can be incorrect.
    // Better approach: Check if there's a clock-in for today. If not, check yesterday.
    // If clock-in exists for today, use today. Otherwise, use the date of the most recent clock-in.
    const normalizedCurdate = dateOnly(curdate); // Normalize curdate for comparison
    
    const todayClockIn = await prisma.biologs.findFirst({
      where: {
        bio_emp: params.bioEmp,
        bio_type: "I",
        bio_date: normalizedCurdate, // Check for clock-in on current date
      },
      orderBy: {
        bio_logdate: "desc",
      },
    });
    
    if (todayClockIn) {
      // Clock-in exists for today, use today's date
      finalDate = new Date(curdate);
    } else {
      // No clock-in for today, check if there's one for yesterday
      const yesterday = new Date(curdate);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayDate = dateOnly(yesterday);
      
      const yesterdayClockIn = await prisma.biologs.findFirst({
        where: {
          bio_emp: params.bioEmp,
          bio_type: "I",
          bio_date: yesterdayDate,
        },
        orderBy: {
          bio_logdate: "desc",
        },
      });
      
      if (yesterdayClockIn) {
        // Clock-in exists for yesterday, use yesterday's date
        finalDate = new Date(yesterdayDate);
      } else {
        // No clock-in found for today or yesterday, fall back to SP logic
        // SP: IF _in < _now THEN set _finaldate=CURDATE() - INTERVAL 1 DAY; ELSE set _finaldate=CURDATE();
        if (_in != null && _in < _now) {
          finalDate = new Date(curdate);
          finalDate.setUTCDate(finalDate.getUTCDate() - 1);
        } else {
          finalDate = new Date(curdate);
        }
      }
    }
    // SP: set _finaltime=CURTIME();
    finalTime = curtime;
  } else if (params.bioType === "BO" || params.bioType === "BI") {
    // SP: set _finaltime=CURTIME(); (SP doesn't set _finaldate for BI/BO - we use CURDATE() for INSERT)
    finalDate = new Date(curdate);
    finalTime = curtime;
  } else {
    // Fallback
    finalDate = new Date(curdate);
    finalTime = curtime;
  }

  // Normalize finalDate to UTC midnight for consistent date comparison and storage
  const normalizedFinalDate = dateOnly(finalDate);

  // SP: INSERT INTO biologs (bio_id,bio_emp,bio_date,bio_type,bio_time,bio_ip,bio_loc,bio_local)
  // SP: VALUES (_bioid,_bio_emp,_finaldate,_bio_type,_finaltime,_ip_address,_location,_local);
  await prisma.biologs.create({
    data: {
      bio_id,
      bio_emp: params.bioEmp,
      bio_date: normalizedFinalDate,
      bio_type: params.bioType,
      bio_time: finalTime,
      bio_ip: params.ipAddress,
      bio_loc: params.location,
      bio_local: params.local || "L1",
    },
  });

  // SP: select if(hol_type="Legal Holiday","Y1",if(hol_type="Special Non-Working Holiday","Y2","Y3")) into _holtype
  // SP: from holiday where hol_date=_finaldate and hol_location=_local;
  // SP: if isnull(_holtype) then set _holtype='N'; end if;
  const holiday = await prisma.holiday.findFirst({
    where: { hol_date: normalizedFinalDate, hol_location: params.local },
  });
  let holtype: string;
  if (holiday) {
    if (holiday.hol_type === "Legal Holiday") {
      holtype = "Y1";
    } else if (holiday.hol_type === "Special Non-Working Holiday") {
      holtype = "Y2";
    } else {
      holtype = "Y3";
    }
  } else {
    holtype = "N";
  }

  // SP: CASE WHEN _bio_type = "I" THEN UPDATE attendance SET ...
  // Use UTC to ensure correct date/time representation (normalizedFinalDate is defined above)
  const finalDateTime = new Date(Date.UTC(normalizedFinalDate.getUTCFullYear(), normalizedFinalDate.getUTCMonth(), normalizedFinalDate.getUTCDate(), finalTime.getHours(), finalTime.getMinutes(), finalTime.getSeconds()));

  // Ensure attendance row exists (SP assumes make_daily created it)
  await ensureAttendanceRowForPunch(normalizedFinalDate, params.bioEmp);

  if (params.bioType === "I") {
    // SP: UPDATE attendance SET att_bioin=cast(concat(_finaldate,' ',_finaltime) as datetime),att_holiday=_holtype,att_local=_local
    // SP: WHERE att_date=_finaldate AND att_emp=_bio_emp AND ISNULL(att_bioin) AND ISNULL(att_paycode);
    await prisma.attendance.updateMany({
      where: {
        att_date: normalizedFinalDate,
        att_emp: params.bioEmp,
        att_bioin: null,
        att_paycode: null,
      },
      data: {
        att_bioin: finalDateTime,
        att_holiday: holtype,
        att_local: params.local || undefined,
      },
    });
  } else if (params.bioType === "O") {
    // SP: UPDATE attendance SET att_bioout=cast(concat(_finaldate,' ',_finaltime) as datetime)
    // SP: WHERE att_date=_finaldate AND att_emp=_bio_emp AND ISNULL(att_paycode);
    await prisma.attendance.updateMany({
      where: {
        att_date: normalizedFinalDate,
        att_emp: params.bioEmp,
        att_paycode: null,
      },
      data: { att_bioout: finalDateTime },
    });
  } else if (params.bioType === "BI") {
    // SP: UPDATE attendance SET att_brkin=cast(concat(_finaldate,' ',_finaltime) as datetime)
    // SP: WHERE att_date=_finaldate AND att_emp=_bio_emp AND ISNULL(att_paycode);
    await prisma.attendance.updateMany({
      where: {
        att_date: normalizedFinalDate,
        att_emp: params.bioEmp,
        att_paycode: null,
      },
      data: { att_brkin: finalDateTime },
    });
  } else if (params.bioType === "BO") {
    // SP: UPDATE attendance SET att_brkout=cast(concat(_finaldate,' ',_finaltime) as datetime)
    // SP: WHERE att_date=_finaldate AND att_emp=_bio_emp AND ISNULL(att_paycode);
    await prisma.attendance.updateMany({
      where: {
        att_date: normalizedFinalDate,
        att_emp: params.bioEmp,
        att_paycode: null,
      },
      data: { att_brkout: finalDateTime },
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
  const dayOfMonth = today.getUTCDate();
  const isFirstHalf = dayOfMonth <= 15;

  // Attendance rows are stored at UTC midnight (see dateOnly()), so month
  // boundaries must also be UTC midnight. Using local midnight (new Date(y,m,d))
  // clips the last day of the month on positive-offset timezones (e.g. UTC+8),
  // which hides today's row from the grid even after a successful clock-in.
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));

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
  fifteenDaysAgo.setUTCDate(today.getUTCDate() - 15);
  const prevCutoffYear = fifteenDaysAgo.getUTCFullYear();
  const prevCutoffMonth = fifteenDaysAgo.getUTCMonth();
  const prevCutoffFirst = new Date(Date.UTC(prevCutoffYear, prevCutoffMonth, 1));
  const prevCutoffLast = new Date(Date.UTC(prevCutoffYear, prevCutoffMonth + 1, 0));

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
    const day = d.getUTCDate();
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
    const day = dateOnly(a.att_date).getUTCDate();
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
