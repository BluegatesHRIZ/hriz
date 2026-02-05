import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { serializeForJson } from "@/lib/utils";

/**
 * GET /api/approval
 * Get approval list for the logged-in approver
 * Mirrors get_approvals stored procedure
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded = verifyToken(authHeader.substring(7));
    const approverId = decoded.name;

    if (!approverId) {
      return NextResponse.json(
        { message: "Approver ID not found" },
        { status: 400 }
      );
    }

    // Mirror get_approvals SP logic:
    // Get minimum level for each taskid where fa_appstat='0' AND fa_status='0'
    // Then join with forapproval to get full records at that level
    const minLevels = await prisma.forapproval.groupBy({
      by: ["fa_taskid"],
      where: {
        fa_appstat: 0,
        fa_status: 0,
      },
      _min: {
        fa_level: true,
      },
    });

    const taskIds = minLevels.map((m) => m.fa_taskid).filter(Boolean) as string[];
    const minLevelMap = new Map<string, number>();
    for (const m of minLevels) {
      if (m.fa_taskid && m._min.fa_level != null) {
        minLevelMap.set(m.fa_taskid, m._min.fa_level);
      }
    }

    if (taskIds.length === 0) {
      return NextResponse.json([]);
    }

    // Get approvals at the minimum level for each taskid
    const approvals = await prisma.forapproval.findMany({
      where: {
        fa_taskid: { in: taskIds },
        fa_appvr: approverId,
      },
    });

    // Filter to only include approvals at the minimum level for each taskid
    const filteredApprovals = approvals.filter((a) => {
      const minLevel = minLevelMap.get(a.fa_taskid ?? "");
      return minLevel != null && a.fa_level === minLevel;
    });

    // Get menu and employee data
    const menuIds = [...new Set(filteredApprovals.map((a) => a.fa_menu).filter(Boolean))] as string[];
    const empIds = [...new Set(filteredApprovals.map((a) => a.fa_emp).filter(Boolean))] as string[];

    const [menus, employees] = await Promise.all([
      menuIds.length > 0
        ? prisma.menu.findMany({
            where: { mnu_id: { in: menuIds } },
            select: { mnu_id: true, mnu_desc: true },
          })
        : [],
      empIds.length > 0
        ? prisma.employee.findMany({
            where: { emp_id: { in: empIds } },
            select: { emp_id: true, emp_first: true, emp_last: true },
          })
        : [],
    ]);

    const menuMap = new Map(menus.map((m) => [m.mnu_id, m.mnu_desc]));
    const empMap = new Map(
      employees.map((e) => [
        e.emp_id,
        `${e.emp_first || ""}, ${e.emp_last || ""}`,
      ])
    );

    // Format response to match SP output
    const result = filteredApprovals.map((a) => ({
      Fa_Id: a.fa_id,
      Fa_TaskId: a.fa_taskid,
      Fa_Emp: a.fa_emp,
      employee: a.fa_emp ? empMap.get(a.fa_emp) ?? null : null,
      Fa_Apprv: a.fa_appvr,
      Fa_Appstat: a.fa_appstat,
      Fa_Module: a.fa_menu ? menuMap.get(a.fa_menu) ?? null : null,
      Fa_Status: a.fa_status,
      Fa_Datetime: a.fa_datetime,
      Fa_Level: a.fa_level,
    }));

    return NextResponse.json(serializeForJson(result));
  } catch (error) {
    console.error("Get approval error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
