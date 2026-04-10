import test from "node:test";
import assert from "node:assert/strict";
import {
  PERMISSIONS,
  combinePermissions,
  hasAllPermissions,
  hasAnyPermission,
  parsePermissionMask,
} from "@/lib/auth/permissions";
const BIGINT_ZERO = BigInt(0);

test("parsePermissionMask handles invalid values", () => {
  assert.equal(parsePermissionMask(""), BIGINT_ZERO);
  assert.equal(parsePermissionMask("abc"), BIGINT_ZERO);
  assert.equal(parsePermissionMask(undefined), BIGINT_ZERO);
});

test("hasAnyPermission supports bitwise checks", () => {
  const userMask = combinePermissions(PERMISSIONS.AccessLeave, PERMISSIONS.AccessUndertime);
  assert.equal(hasAnyPermission(userMask, PERMISSIONS.AccessLeave), true);
  assert.equal(hasAnyPermission(userMask, PERMISSIONS.AccessLoan), false);
});

test("hasAllPermissions supports full requirement checks", () => {
  const userMask = combinePermissions(PERMISSIONS.AccessLeave, PERMISSIONS.AccessUndertime);
  const requiredBoth = combinePermissions(PERMISSIONS.AccessLeave, PERMISSIONS.AccessUndertime);
  const requiredExtra = combinePermissions(PERMISSIONS.AccessLeave, PERMISSIONS.AccessLoan);
  assert.equal(hasAllPermissions(userMask, requiredBoth), true);
  assert.equal(hasAllPermissions(userMask, requiredExtra), false);
});

