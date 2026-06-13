import { prisma } from "@/lib/db/prisma";
import { invalidateAuthorizationCache } from "@/lib/services/authorization.service";

/**
 * Mirrors `RolesAndPermissionController` from the C# server.
 *
 * Data model recap:
 * - `accrole`             → role catalog
 * - `accpermission`       → permission catalog (bitwise per_value)
 * - `accrolepermission`   → many-to-many join with arp_rol / arp_per
 * - `employee.emp_role`   → soft FK referencing accrole.rol_id
 *
 * Stored procedures kept for parity:
 * - `roles_insert(_Rol_Name, _Rol_Desc, OUT _Out_Rol_Id)`
 * - `roles_insert_permission(_Rol_Id, _Per_Id)`
 * - `roles_update(_Rol_Id, _Rol_Name, _Rol_Desc)`
 * - `get_permission_value(_role)` → SUM(per_value) for the role
 */

const SUPERADMIN_ROLE_ID = "SUPERADMIN";
const ALL_ACCESS_PERMISSION_ID = "ACC01";
const NONE_PERMISSION_ID = "NONE00";

export interface RolesDTO {
  RolId: string;
  RolName: string | null;
  RolDesc: string | null;
}

export interface RolesAndPermissionDTO {
  ArpPer: string | null;
  ArpPerName: string | null;
  ArpPerDesc: string | null;
  ArpPerValue: number | null;
}

export interface RolesIncludeDTO {
  RolId: string;
  RolName: string | null;
  RolDesc: string | null;
  RolesAndPermissionNav: RolesAndPermissionDTO[];
}

export interface PermissionsDTO {
  PerId: string;
  PerName: string | null;
  PerDesc: string | null;
  PerValue: number | null;
}

export interface PermissionValueDTO {
  EmpRole: string;
  PerValue: string;
}

/**
 * Lists every non-SUPERADMIN role (mirrors `GET api/RolesAndPermission/role`).
 */
export async function listRoles(): Promise<RolesDTO[]> {
  const rows = await prisma.accrole.findMany({
    where: { rol_id: { not: SUPERADMIN_ROLE_ID } },
    orderBy: { rol_name: "asc" },
    select: { rol_id: true, rol_name: true, rol_desc: true },
  });
  return rows.map((r) => ({
    RolId: r.rol_id,
    RolName: r.rol_name,
    RolDesc: r.rol_desc,
  }));
}

/**
 * Lists each role with its bundled permissions (mirrors C# Include navigation).
 */
export async function listRoleAndPermissions(): Promise<RolesIncludeDTO[]> {
  const roles = await prisma.accrole.findMany({
    where: { rol_id: { not: SUPERADMIN_ROLE_ID } },
    orderBy: { rol_name: "asc" },
    select: { rol_id: true, rol_name: true, rol_desc: true },
  });
  if (roles.length === 0) return [];

  const roleIds = roles.map((r) => r.rol_id);

  const links = await prisma.accrolepermission.findMany({
    where: { arp_rol: { in: roleIds } },
    select: { arp_rol: true, arp_per: true },
  });

  const permissionIds = Array.from(
    new Set(links.map((l) => l.arp_per).filter((id): id is string => Boolean(id))),
  );

  const permissions = permissionIds.length
    ? await prisma.accpermission.findMany({
        where: { per_id: { in: permissionIds } },
        select: { per_id: true, per_name: true, per_desc: true, per_value: true },
      })
    : [];
  const permissionMap = new Map(permissions.map((p) => [p.per_id, p] as const));

  return roles.map((role) => ({
    RolId: role.rol_id,
    RolName: role.rol_name,
    RolDesc: role.rol_desc,
    RolesAndPermissionNav: links
      .filter((l) => l.arp_rol === role.rol_id)
      .map((l) => {
        const perm = l.arp_per ? permissionMap.get(l.arp_per) : null;
        return {
          ArpPer: l.arp_per ?? null,
          ArpPerName: perm?.per_name ?? null,
          ArpPerDesc: perm?.per_desc ?? null,
          ArpPerValue:
            perm?.per_value !== null && perm?.per_value !== undefined
              ? Number(perm.per_value)
              : null,
        };
      }),
  }));
}

/**
 * Lists every permission except `AllAccess` and `None` (used by the Role popup
 * combo / tag boxes – mirrors `GET api/RolesAndPermission/permission`).
 */
export async function listPermissions(): Promise<PermissionsDTO[]> {
  const rows = await prisma.accpermission.findMany({
    where: {
      per_id: { notIn: [ALL_ACCESS_PERMISSION_ID, NONE_PERMISSION_ID] },
    },
    orderBy: { per_name: "asc" },
    select: { per_id: true, per_name: true, per_desc: true, per_value: true },
  });
  return rows.map((p) => ({
    PerId: p.per_id,
    PerName: p.per_name,
    PerDesc: p.per_desc,
    PerValue:
      p.per_value !== null && p.per_value !== undefined ? Number(p.per_value) : null,
  }));
}

/**
 * Calls `get_permission_value(_role)` and folds the result into a string so the
 * caller can build a `BigInt` without losing precision on large bitmasks.
 */
export async function getPermissionValue(
  role: string,
): Promise<PermissionValueDTO | null> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ emp_role: string | null; per_value: number | bigint | string | null }>
  >(`CALL get_permission_value(?)`, role);

  const first = rows?.[0];
  const total =
    first?.per_value !== null && first?.per_value !== undefined
      ? BigInt(first.per_value.toString())
      : BigInt(0);

  return { EmpRole: role, PerValue: total.toString() };
}

function ensurePermissionIdsUnique(perIds: Array<string | null | undefined>): string[] {
  const cleaned = perIds
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id.length > 0);
  return Array.from(new Set(cleaned));
}

export interface RoleMutationResult {
  RolId: string;
  RolName: string | null;
  RolDesc: string | null;
}

/**
 * Mirrors `POST api/RolesAndPermission/create-role`. Calls the `roles_insert`
 * proc (which generates the `ROLE######` id atomically on the DB side) and
 * loops `roles_insert_permission` for each permission. Running everything
 * inside `prisma.$transaction` guarantees the user-defined `@out_rol_id`
 * session variable survives across statements (same connection).
 */
export async function createRole(
  rolName: string,
  rolDesc: string,
  perIds: Array<string | null | undefined>,
): Promise<RoleMutationResult> {
  const trimmedName = rolName?.trim() ?? "";
  const trimmedDesc = rolDesc?.trim() ?? "";
  if (!trimmedName || !trimmedDesc) {
    throw new Error("Role name and description are required");
  }
  const permissionIds = ensurePermissionIdsUnique(perIds);

  const rolId = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET @out_rol_id = ''`);
    await tx.$executeRawUnsafe(
      `CALL roles_insert(?, ?, @out_rol_id)`,
      trimmedName,
      trimmedDesc,
    );

    const rows = await tx.$queryRawUnsafe<Array<{ rol_id: string | null }>>(
      `SELECT @out_rol_id AS rol_id`,
    );
    const newId = rows?.[0]?.rol_id ?? "";
    if (!newId) {
      throw new Error("roles_insert did not return a role id");
    }

    for (const perId of permissionIds) {
      await tx.$executeRawUnsafe(
        `CALL roles_insert_permission(?, ?)`,
        newId,
        perId,
      );
    }
    return newId;
  });

  invalidateAuthorizationCache();
  return { RolId: rolId, RolName: trimmedName, RolDesc: trimmedDesc };
}

/**
 * Mirrors `PUT api/RolesAndPermission/update-role/{id}`. Calls `roles_update`,
 * wipes the existing `accrolepermission` rows for the role, then re-inserts
 * the supplied set via `roles_insert_permission`.
 */
export async function updateRole(
  rolId: string,
  rolName: string,
  rolDesc: string,
  perIds: Array<string | null | undefined>,
): Promise<RoleMutationResult> {
  const trimmedId = rolId?.trim() ?? "";
  const trimmedName = rolName?.trim() ?? "";
  const trimmedDesc = rolDesc?.trim() ?? "";
  if (!trimmedId) throw new Error("Role id is required");
  if (!trimmedName || !trimmedDesc) {
    throw new Error("Role name and description are required");
  }

  const existing = await prisma.accrole.findUnique({ where: { rol_id: trimmedId } });
  if (!existing) throw new Error("Role not found");
  if (existing.rol_id === SUPERADMIN_ROLE_ID || !existing.rol_id.startsWith("ROLE")) {
    throw new Error("Default roles cannot be modified");
  }

  const permissionIds = ensurePermissionIdsUnique(perIds);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `CALL roles_update(?, ?, ?)`,
      trimmedId,
      trimmedName,
      trimmedDesc,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM accrolepermission WHERE arp_rol = ?`,
      trimmedId,
    );
    for (const perId of permissionIds) {
      await tx.$executeRawUnsafe(
        `CALL roles_insert_permission(?, ?)`,
        trimmedId,
        perId,
      );
    }
  });

  invalidateAuthorizationCache();
  return { RolId: trimmedId, RolName: trimmedName, RolDesc: trimmedDesc };
}

/**
 * Mirrors `PUT api/RolesAndPermission/delete-role/{id}`: refuse to delete if
 * any employee still references the role, then run the same `DELETE` pair the
 * C# controller does (no stored proc for delete in `stored_proc.sql`).
 */
export async function deleteRole(rolId: string): Promise<void> {
  const trimmedId = rolId?.trim() ?? "";
  if (!trimmedId) throw new Error("Role id is required");

  const existing = await prisma.accrole.findUnique({ where: { rol_id: trimmedId } });
  if (!existing) throw new Error("Role not found");
  if (existing.rol_id === SUPERADMIN_ROLE_ID || !existing.rol_id.startsWith("ROLE")) {
    throw new Error("Default roles cannot be deleted");
  }

  const assigned = await prisma.employee.findFirst({
    where: { emp_role: trimmedId },
    select: { emp_id: true },
  });
  if (assigned) {
    // Mirrors C# `"Role" + Error.Code[706]`: role still in use.
    throw new Error("Role is still assigned to one or more employees");
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `DELETE FROM accrole WHERE rol_id = ?`,
      trimmedId,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM accrolepermission WHERE arp_rol = ?`,
      trimmedId,
    );
  });

  invalidateAuthorizationCache();
}
