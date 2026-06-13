import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { createRole, listRoles } from "@/lib/services/rolesPermissions.service";

interface CreateRoleBody {
  RolName?: string | null;
  RolDesc?: string | null;
  RolPermission?: Array<{ PerId?: string | null }> | null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiRolesPermissionsRead");
    if (!auth.ok) return auth.response;

    const roles = await listRoles();
    return NextResponse.json(roles);
  } catch (error) {
    console.error("List roles error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiRolesPermissionsWrite");
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as CreateRoleBody;
    const perIds = (body.RolPermission ?? [])
      .map((p) => p?.PerId ?? "")
      .filter((id) => id.length > 0);

    const role = await createRole(body.RolName ?? "", body.RolDesc ?? "", perIds);
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Create role error:", error);
    const status = message.toLowerCase().includes("required") ? 400 : 500;
    return NextResponse.json({ message }, { status });
  }
}
