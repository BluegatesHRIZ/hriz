import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { listRoleAndPermissions } from "@/lib/services/rolesPermissions.service";

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiRolesPermissionsRead");
    if (!auth.ok) return auth.response;

    const rows = await listRoleAndPermissions();
    return NextResponse.json(rows);
  } catch (error) {
    console.error("List role-and-permission error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
