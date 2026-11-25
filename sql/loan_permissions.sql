-- Loan Approve and Loan Release permissions (Manage Loans).
-- Values match PERMISSIONS.LoanApprove / PERMISSIONS.LoanRelease in
-- lib/auth/permissions.ts. FUNC* ids show under "Function Permissions" in
-- Role Management. Safe to re-run.
INSERT INTO accpermission (per_id, per_name, per_desc, per_value)
VALUES
  ('FUNC18', 'Loan Approve', 'Approve or reject loan requests in Manage Loans', 4398046511104),
  ('FUNC19', 'Loan Release', 'Set repayment terms and release approved loans to payroll', 8796093022208)
ON DUPLICATE KEY UPDATE
  per_name = VALUES(per_name),
  per_desc = VALUES(per_desc),
  per_value = VALUES(per_value);

-- Default roles (Administrator, Human Resource) cannot be edited in Role
-- Management, so grant them here. Custom roles are ticked in the UI.
INSERT INTO accrolepermission (arp_rol, arp_per)
SELECT r.rol_id, p.per_id
FROM accrole r
JOIN accpermission p ON p.per_id IN ('FUNC18', 'FUNC19')
WHERE r.rol_id IN ('ADMIN', 'HR')
  AND NOT EXISTS (
    SELECT 1 FROM accrolepermission x
    WHERE x.arp_rol = r.rol_id AND x.arp_per = p.per_id
  );
