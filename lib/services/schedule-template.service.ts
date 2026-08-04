import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { formatTimeForDatabase, formatTimeForInput } from "@/lib/utils/time";
import { timeStringToDate } from "@/lib/services/schedule.service";

/**
 * A single day of a saved schedule template. Same shape the frontend day editor
 * uses, so a template's days can be fed straight into `bulkApplySchedule`.
 */
export interface TemplateDay {
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

export interface ScheduleTemplateInput {
  name: string;
  description?: string | null;
  createdBy?: string | null;
  days: TemplateDay[];
}

export interface ScheduleTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  logDate: Date | null;
}

export interface ScheduleTemplateDetail extends ScheduleTemplateSummary {
  days: TemplateDay[];
}

function newTemplateId(): string {
  return `SCT-${randomUUID().replace(/-/g, "").substring(0, 16)}`; // fits VarChar(20)
}

function newDetailId(): string {
  return randomUUID().replace(/-/g, "").substring(0, 32); // fits VarChar(40)
}

function detailToDay(d: {
  sct_dday: string | null;
  sct_din: Date | null;
  sct_dout: Date | null;
  sct_dbin: Date | null;
  sct_dbout: Date | null;
  sct_dhrs: number | null;
  sct_drest: number | null;
  sct_dshift: string | null;
  sct_dbreak: number | null;
}): TemplateDay {
  return {
    sch_day: d.sct_dday ?? "",
    sch_in: formatTimeForInput(d.sct_din) ?? "",
    sch_out: formatTimeForInput(d.sct_dout) ?? "",
    sch_bin: formatTimeForInput(d.sct_dbin) ?? "",
    sch_bout: formatTimeForInput(d.sct_dbout) ?? "",
    sch_hrs: d.sct_dhrs ?? 0,
    sch_rest: d.sct_drest === 1,
    sch_shift: d.sct_dshift ?? "R",
    have_break: d.sct_dbreak === 1,
  };
}

function buildDetailRows(templateId: string, days: TemplateDay[]) {
  return days.map((d) => ({
    sct_did: newDetailId(),
    sct_dpk: templateId,
    sct_dday: d.sch_day,
    sct_din: timeStringToDate(formatTimeForDatabase(d.sch_in)),
    sct_dout: timeStringToDate(formatTimeForDatabase(d.sch_out)),
    sct_dbin: timeStringToDate(formatTimeForDatabase(d.sch_bin)),
    sct_dbout: timeStringToDate(formatTimeForDatabase(d.sch_bout)),
    sct_dhrs: d.sch_hrs,
    sct_drest: d.sch_rest ? 1 : 0,
    sct_dshift: d.sch_shift,
    sct_dbreak: d.have_break ? 1 : 0,
  }));
}

export async function listScheduleTemplates(): Promise<ScheduleTemplateSummary[]> {
  const rows = await prisma.scheduletemplate.findMany({
    where: { sct_tstatus: 1 },
    orderBy: { sct_tname: "asc" },
  });
  return rows.map((r) => ({
    id: r.sct_tid,
    name: r.sct_tname,
    description: r.sct_tdesc,
    createdBy: r.sct_tby,
    logDate: r.sct_tlogdate,
  }));
}

export async function getScheduleTemplate(
  id: string
): Promise<ScheduleTemplateDetail | null> {
  const template = await prisma.scheduletemplate.findUnique({
    where: { sct_tid: id },
  });
  if (!template) return null;
  const details = await prisma.scheduletemplatedetail.findMany({
    where: { sct_dpk: id },
  });
  return {
    id: template.sct_tid,
    name: template.sct_tname,
    description: template.sct_tdesc,
    createdBy: template.sct_tby,
    logDate: template.sct_tlogdate,
    days: details.map(detailToDay),
  };
}

export async function createScheduleTemplate(
  input: ScheduleTemplateInput
): Promise<string> {
  const id = newTemplateId();
  const detailRows = buildDetailRows(id, input.days);
  await prisma.$transaction([
    prisma.scheduletemplate.create({
      data: {
        sct_tid: id,
        sct_tname: input.name,
        sct_tdesc: input.description ?? null,
        sct_tby: input.createdBy ?? null,
        sct_tstatus: 1,
      },
    }),
    prisma.scheduletemplatedetail.createMany({ data: detailRows }),
  ]);
  return id;
}

export async function updateScheduleTemplate(
  id: string,
  input: ScheduleTemplateInput
): Promise<void> {
  const detailRows = buildDetailRows(id, input.days);
  await prisma.$transaction([
    prisma.scheduletemplate.update({
      where: { sct_tid: id },
      data: {
        sct_tname: input.name,
        sct_tdesc: input.description ?? null,
      },
    }),
    prisma.scheduletemplatedetail.deleteMany({ where: { sct_dpk: id } }),
    prisma.scheduletemplatedetail.createMany({ data: detailRows }),
  ]);
}

export async function deleteScheduleTemplate(id: string): Promise<void> {
  // Soft-delete the header; drop details so they don't linger.
  await prisma.$transaction([
    prisma.scheduletemplate.update({
      where: { sct_tid: id },
      data: { sct_tstatus: 0 },
    }),
    prisma.scheduletemplatedetail.deleteMany({ where: { sct_dpk: id } }),
  ]);
}
