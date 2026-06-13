import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { deleteRole, updateRole } from "@/lib/services/rolesPermissions.service";

interface UpdateRoleBody {
  RolName?: string | null;
  RolDesc?: string | null;
  RolPermission?: Array<{ PerId?: string | null }> | null;
}

function classifyError(message: string): number {
  const lower = message.toLowerCase();
  if (lower.includes("not found")) return 404;
  if (lower.includes("default roles")) return 403;
  if (lower.includes("still assigned")) return 409;
  if (lower.includes("required")) return 400;
  return 500;
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiRolesPermissionsWrite");
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const body = (await request.json()) as UpdateRoleBody;
    const perIds = (body.RolPermission ?? [])
      .map((p) => p?.PerId ?? "")
      .filter((value) => value.length > 0);

    const role = await updateRole(id, body.RolName ?? "", body.RolDesc ?? "", perIds);
    return NextResponse.json(role);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Update role error:", error);
    return NextResponse.json({ message }, { status: classifyError(message) });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiRolesPermissionsWrite");
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    await deleteRole(id);
    return NextResponse.json({ message: "Role deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Delete role error:", error);
    return NextResponse.json({ message }, { status: classifyError(message) });
  }
}
