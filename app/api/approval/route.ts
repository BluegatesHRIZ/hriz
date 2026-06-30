import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { serializeForJson } from "@/lib/utils";
import { parsePagination, paginate } from "@/lib/pagination";

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

    const decoded = await verifyToken(authHeader.substring(7));
    const approverId = decoded.name;

    if (!approverId) {
      return NextResponse.json(
        { message: "Approver ID not found" },
        { status: 400 }
      );
    }

    const { page, limit, skip, take } = parsePagination(request.nextUrl.searchParams);

    // Mirror get_approvals SP exactly:
    // SELECT p1.* FROM forapproval p1
    // INNER JOIN (SELECT min(fa_level) fa_level, fa_taskid FROM forapproval WHERE fa_appstat='0' AND fa_status='0' GROUP BY fa_taskid) p2
    //   ON p1.fa_taskid = p2.fa_taskid AND p1.fa_level = p2.fa_level
    // LEFT JOIN menu ON menu.mnu_id = p1.fa_menu
    // LEFT JOIN employee ON employee.emp_id = p1.fa_emp;
    // Then filter by approver in memory (matching C# behavior)
    
    // Get minimum level for each taskid where fa_appstat='0' AND fa_status='0'
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

    const taskIds = minLevels.map((m: typeof minLevels[number]) => m.fa_taskid).filter(Boolean) as string[];
    const minLevelMap = new Map<string, number>();
    for (const m of minLevels) {
      if (m.fa_taskid && m._min.fa_level != null) {
        minLevelMap.set(m.fa_taskid, m._min.fa_level);
      }
    }

    if (taskIds.length === 0) {
      console.log(`Get approval: No pending approvals found (fa_appstat=0 AND fa_status=0)`);
      return NextResponse.json(paginate([], 0, page, limit));
    }

    // Get ALL approvals at the minimum level for each taskid (matching SP - no filter by approver yet)
    const approvals = await prisma.forapproval.findMany({
      where: {
        fa_taskid: { in: taskIds },
      },
    });

    // Filter to only include approvals at the minimum level for each taskid
    const approvalsAtMinLevel = approvals.filter((a: typeof approvals[number]) => {
      const minLevel = minLevelMap.get(a.fa_taskid ?? "");
      return minLevel != null && a.fa_level === minLevel;
    });

    // Filter by approver in memory (matching C# behavior: .Where((approval) => approval.Fa_Apprv == emp_id))
    const filteredApprovals = approvalsAtMinLevel.filter(
      (a: typeof approvalsAtMinLevel[number]) => a.fa_appvr === approverId
    );

    console.log(
      `Get approval: Found ${filteredApprovals.length} approvals for approver "${approverId}" ` +
      `(from ${approvalsAtMinLevel.length} total at min level, ${approvals.length} total approvals)`
    );
    
    // Debug: Log all approvers in the approvals at min level
    if (approvalsAtMinLevel.length > 0) {
      const approvers = [...new Set(approvalsAtMinLevel.map((a) => a.fa_appvr).filter(Boolean))];
      console.log(
        `Get approval: Approvers in min level approvals: ${approvers.join(", ")} (looking for "${approverId}")`
      );
    }
    
    // Debug: Log all taskIds we're looking at
    console.log(`Get approval: Task IDs with pending approvals: ${taskIds.join(", ")}`);

    // Get menu and employee data
    const menuIds = [...new Set(filteredApprovals.map((a: typeof filteredApprovals[number]) => a.fa_menu).filter(Boolean))] as string[];
    const empIds = [...new Set(filteredApprovals.map((a: typeof filteredApprovals[number]) => a.fa_emp).filter(Boolean))] as string[];

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

    const menuMap = new Map(menus.map((m: typeof menus[number]) => [m.mnu_id, m.mnu_desc] as const));
    const empMap = new Map(
      employees.map((e: typeof employees[number]) => [
        e.emp_id,
        `${e.emp_first || ""}, ${e.emp_last || ""}`,
      ] as const)
    );

    // Format response to match SP output
    const result = filteredApprovals.map((a: typeof filteredApprovals[number]) => ({
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

    // Approver filtering happens in memory (can't be pushed to SQL), so paginate
    // the resolved list; total reflects the full filtered count.
    const pageItems = result.slice(skip, skip + take);
    return NextResponse.json(
      paginate(serializeForJson(pageItems) as typeof pageItems, result.length, page, limit)
    );
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
