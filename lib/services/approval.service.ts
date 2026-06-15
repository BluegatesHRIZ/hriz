import { prisma } from "@/lib/db/prisma";

/**
 * Approval service (Prisma-based).
 * Mirrors stored procedure ApprovalStatus exactly (reference: sql/stored_proc.sql).
 */
export async function approvalStatus(params: {
  taskId: string;
  employee: string;
  approver: string;
  appStatus: number; // 1 = Approve, 2 = Reject, 4 = Resend
}) {
  const { taskId, employee, approver, appStatus } = params;
  const modtype = taskId.split("-")[0];
  let modstat = "";
  let lastapprove = false;

  if (appStatus === 2 || appStatus === 4) {
    await prisma.forapproval.updateMany({
      where: { fa_taskid: taskId },
      data: { fa_status: appStatus },
    });
    await updateModuleStatus(modtype, taskId, appStatus, approver);
    lastapprove = true;
    if (appStatus === 2) {
      modstat = "REJECTED";
    } else {
      modstat = "RESUBMITTED";
    }
  } else {
    await prisma.forapproval.updateMany({
      where: { fa_taskid: taskId },
      data: { fa_appstat: appStatus },
    });
  }

  const lastFa = await prisma.forapproval.findFirst({
    where: { fa_emp: employee, fa_taskid: taskId },
    orderBy: { fa_level: "desc" },
    select: { fa_appstat: true },
  });

  if (lastFa?.fa_appstat === 1) {
    await updateModuleStatus(modtype, taskId, appStatus, approver);
    if (modtype === "LEA") {
      const leave = await prisma.leave_summary.findUnique({
        where: { lea_sid: taskId },
        select: { lea_stype: true, lea_swithpay: true },
      });
      if (leave?.lea_stype != null && leave.lea_swithpay != null) {
        const emlId = `${employee}${leave.lea_stype}`;
        await prisma.empleave.update({
          where: { eml_id: emlId },
          data: { eml_used: { increment: leave.lea_swithpay } },
        });
      }
    }
    modstat = "APPROVED";
    lastapprove = true;
  }

  // Call insert_notif if modstat is not empty
  if (modstat !== "") {
    const modname =
      modtype === "LEA"
        ? "Leave"
        : modtype === "COA"
        ? "Attendance Change"
        : modtype === "OVT"
        ? "Overtime"
        : modtype === "UNT"
        ? "Undertime"
        : modtype === "SCA"
        ? "Schedule Change"
        : modtype === "LOA"
        ? "Loan"
        : "";
    if (modname) {
      await prisma.notification.create({
        data: {
          not_emp: employee,
          not_title: "Approval Status",
          not_desc: `Your ${modname} request has been ${modstat}`,
          not_createdby: approver,
        },
      });
    }
  }

  // Get employee email
  const personal = await prisma.emppersonal.findFirst({
    where: { emp_id: employee },
    select: { emp_email: true },
  });

  return {
    lastapprove,
    email: personal?.emp_email ?? null,
  };
}

async function updateModuleStatus(
  modtype: string,
  taskId: string,
  appStatus: number,
  approver: string
) {
  const now = new Date();
  switch (modtype) {
    case "LEA":
      await prisma.leave_summary.update({
        where: { lea_sid: taskId },
        data: {
          lea_sstatus: appStatus,
          lea_sapprovedby: approver,
          lea_sapproveddate: now,
        },
      });
      break;
    case "COA":
      await prisma.coa_summary.update({
        where: { coa_sid: taskId },
        data: {
          coa_sstatus: appStatus,
          coa_sapprovedby: approver,
          coa_sapproveddate: now,
        },
      });
      break;
    case "OVT":
      await prisma.overtime.update({
        where: { otm_id: taskId },
        data: {
          otm_status: appStatus,
          otm_approvedby: approver,
          otm_approveddate: now,
        },
      });
      break;
    case "UNT":
      await prisma.undertime.update({
        where: { utm_id: taskId },
        data: {
          utm_status: appStatus,
          utm_approvedby: approver,
          utm_approveddate: now,
        },
      });
      break;
    case "SCA":
      await prisma.schedadjust_summary.update({
        where: { sca_sid: taskId },
        data: {
          sca_sstatus: appStatus,
          sca_sapprovedby: approver,
          sca_sapproveddate: now,
        },
      });
      break;
    case "LOA":
      await prisma.loan.update({
        where: { loa_id: taskId },
        data: {
          loa_status: appStatus,
          loa_approvedby: approver,
          loa_approveddate: now,
        },
      });
      break;
    default:
      break;
  }
}
