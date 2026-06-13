import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { getPermissionValue } from "@/lib/services/rolesPermissions.service";

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiRolesPermissionsRead");
    if (!auth.ok) return auth.response;

    const role = request.nextUrl.searchParams.get("role");
    if (!role) {
      return NextResponse.json(
        { message: "Missing role query parameter" },
        { status: 400 }
      );
    }

    const value = await getPermissionValue(role);
    return NextResponse.json(value);
  } catch (error) {
    console.error("Get permission-value error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
