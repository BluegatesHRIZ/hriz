import { prisma } from "@/lib/db/prisma";

/**
 * Status service (Prisma-based).
 * Mirrors stored procedure displayStatusMinutes exactly (reference: sql/stored_proc.sql).
 * Returns undertime/overtime/late/absents aggregates for previous and current pay periods.
 */
export async function displayStatusMinutes(
  employee: string
): Promise<Record<string, number> | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfMonth = today.getDate();
  let previousFrom: Date;
  let previousTo: Date;
  let currentFrom: Date;
  let currentTo: Date;

  // Mirrors SP date calculation logic exactly
  if (dayOfMonth <= 15) {
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    previousFrom = new Date(
      prevMonth.getFullYear(),
      prevMonth.getMonth(),
      16
    );
    previousTo = new Date(
      prevMonth.getFullYear(),
      prevMonth.getMonth() + 1,
      0
    );
    currentFrom = new Date(today.getFullYear(), today.getMonth(), 1);
    currentTo = new Date(today.getFullYear(), today.getMonth(), 15);
  } else {
    previousFrom = new Date(today.getFullYear(), today.getMonth(), 1);
    previousTo = new Date(today.getFullYear(), today.getMonth(), 15);
    currentFrom = new Date(today.getFullYear(), today.getMonth(), 16);
    currentTo = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  }

  const DAY_NAMES = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];

  // Mirrors SP: TIMESTAMPDIFF(MINUTE, clock_out, schedule_out) where > 0
  async function sumUndertime(from: Date, to: Date): Promise<number> {
    const bios = await prisma.biologs.findMany({
      where: {
        bio_emp: employee,
        bio_type: "O",
        bio_date: { gte: from, lte: to },
      },
    });
    let total = 0;
    for (const b of bios) {
      if (!b.bio_date || !b.bio_time) continue;
      const dayName = DAY_NAMES[new Date(b.bio_date).getDay()];
      const sched = await prisma.schedule.findFirst({
        where: { sch_emp: employee, sch_day: dayName },
        select: { sch_out: true },
      });
      if (sched?.sch_out) {
        const clockOut = new Date(b.bio_time);
        const scheduleOut = new Date(sched.sch_out);
        // Set dates to same day for comparison
        scheduleOut.setFullYear(
          clockOut.getFullYear(),
          clockOut.getMonth(),
          clockOut.getDate()
        );
        const diffMinutes =
          (scheduleOut.getTime() - clockOut.getTime()) / 60000;
        if (diffMinutes > 0) total += diffMinutes;
      }
    }
    return total;
  }

  // Mirrors SP: SUM(TIMESTAMPDIFF(MINUTE, otm_from, otm_to))
  async function sumOvertime(from: Date, to: Date): Promise<number> {
    const rows = await prisma.overtime.findMany({
      where: {
        otm_emp: employee,
        otm_status: 1,
        otm_date: { gte: from, lte: to },
      },
      select: { otm_from: true, otm_to: true },
    });
    let total = 0;
    for (const r of rows) {
      if (r.otm_from && r.otm_to) {
        total += (r.otm_to.getTime() - r.otm_from.getTime()) / 60000;
      }
    }
    return total;
  }

  // Mirrors SP: SUM(IF(TIMESTAMPDIFF(MINUTE, clock_in, schedule_in)<0, ...))
  // Negative diff means late (clock_in > schedule_in)
  async function sumLate(from: Date, to: Date): Promise<number> {
    const bios = await prisma.biologs.findMany({
      where: {
        bio_emp: employee,
        bio_type: "I",
        bio_date: { gte: from, lte: to },
      },
    });
    let total = 0;
    for (const b of bios) {
      if (!b.bio_date || !b.bio_time) continue;
      const dayName = DAY_NAMES[new Date(b.bio_date).getDay()];
      const sched = await prisma.schedule.findFirst({
        where: { sch_emp: employee, sch_day: dayName },
        select: { sch_in: true },
      });
      if (sched?.sch_in) {
        const clockIn = new Date(b.bio_time);
        const scheduleIn = new Date(sched.sch_in);
        // Set dates to same day for comparison
        scheduleIn.setFullYear(
          clockIn.getFullYear(),
          clockIn.getMonth(),
          clockIn.getDate()
        );
        const diffMinutes =
          (scheduleIn.getTime() - clockIn.getTime()) / 60000;
        if (diffMinutes < 0) total += Math.abs(diffMinutes);
      }
    }
    return total;
  }

  // Mirrors SP: Count absents (days where msg = "Absent" in current cutoff)
  // SP logic: @today > date_field AND tin IS NULL AND tout IS NULL
  async function countAbsents(): Promise<number> {
    const empWork = await prisma.empwork.findFirst({
      where: { emp_id: employee },
      select: { emp_datehired: true },
    });
    const dateHired = empWork?.emp_datehired;
    if (!dateHired) return 0;

    const isFirstHalf = dayOfMonth <= 15;
    const cutoffStart = isFirstHalf
      ? new Date(today.getFullYear(), today.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth(), 16);
    const cutoffEnd = today;

    // Generate all dates in current cutoff period
    const dates: Date[] = [];
    const current = new Date(cutoffStart);
    while (current <= cutoffEnd) {
      if (current >= dateHired) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    let absentCount = 0;
    for (const dateField of dates) {
      const dayName = DAY_NAMES[dateField.getDay()];
      const sched = await prisma.schedule.findFirst({
        where: { sch_emp: employee, sch_day: dayName },
        select: { sch_rest: true, sch_shift: true },
      });

      // Skip rest days and empty shifts
      if (sched?.sch_rest === 1 || sched?.sch_shift === "E") continue;

      // Check for holiday
      const holiday = await prisma.holiday.findFirst({
        where: {
          hol_status: 1,
          OR: [
            {
              hol_repeat: "Yearly",
              hol_date: {
                gte: new Date(
                  dateField.getFullYear(),
                  dateField.getMonth(),
                  dateField.getDate()
                ),
                lt: new Date(
                  dateField.getFullYear(),
                  dateField.getMonth(),
                  dateField.getDate() + 1
                ),
              },
            },
            {
              hol_repeat: { not: "Yearly" },
              hol_date: {
                gte: new Date(
                  dateField.getFullYear(),
                  dateField.getMonth(),
                  dateField.getDate()
                ),
                lt: new Date(
                  dateField.getFullYear(),
                  dateField.getMonth(),
                  dateField.getDate() + 1
                ),
              },
            },
          ],
        },
      });
      if (holiday) continue;

      // Check for approved leave
      const leave = await prisma.leave_summary.findFirst({
        where: {
          lea_semp: employee,
          lea_sstatus: 1,
          lea_sfrom: { lte: dateField },
          lea_sto: { gte: dateField },
        },
      });
      if (leave) continue;

      // Check biologs: if no bio_in and no bio_out, it's absent
      const bioIn = await prisma.biologs.findFirst({
        where: {
          bio_emp: employee,
          bio_type: "I",
          bio_date: {
            gte: new Date(
              dateField.getFullYear(),
              dateField.getMonth(),
              dateField.getDate()
            ),
            lt: new Date(
              dateField.getFullYear(),
              dateField.getMonth(),
              dateField.getDate() + 1
            ),
          },
        },
      });
      const bioOut = await prisma.biologs.findFirst({
        where: {
          bio_emp: employee,
          bio_type: "O",
          bio_date: {
            gte: new Date(
              dateField.getFullYear(),
              dateField.getMonth(),
              dateField.getDate()
            ),
            lt: new Date(
              dateField.getFullYear(),
              dateField.getMonth(),
              dateField.getDate() + 1
            ),
          },
        },
      });

      if (!bioIn && !bioOut && dateField < today) {
        absentCount++;
      }
    }

    return absentCount;
  }

  const [
    utm_previous,
    utm_current,
    otm_previous,
    otm_current,
    late_current,
    absents,
  ] = await Promise.all([
    sumUndertime(previousFrom, previousTo),
    sumUndertime(currentFrom, currentTo),
    sumOvertime(previousFrom, previousTo),
    sumOvertime(currentFrom, currentTo),
    sumLate(currentFrom, currentTo),
    countAbsents(),
  ]);

  return {
    utm_previous,
    utm_current,
    otm_previous,
    otm_current,
    late_current,
    absents,
  };
}
