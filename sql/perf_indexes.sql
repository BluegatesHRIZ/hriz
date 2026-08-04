-- Performance indexes for the Attendance Report.
--
-- The `attendance` table only has its composite PK `(att_date, att_emp)`, and the
-- overlay source tables + `employee` filter columns have no indexes at all. As a
-- result the 9-statement recompute (lib/services/attendance-recompute.ts) and the
-- summary/detail read queries do full table scans, which is the main reason the
-- report is slow at scale (tenants run 10 - 10,000 employees).
--
-- These are the indexes mirrored as `@@index` in prisma/schema.prisma. This script
-- is what actually creates them on the live MariaDB (the schema is introspected;
-- there are no migration files). Run once against the database:
--
--   mysql -h <host> -u <user> -p <database> < sql/perf_indexes.sql
--
-- Adding an index is non-destructive and safe to re-run: `IF NOT EXISTS` (MariaDB
-- 10.5+) makes each statement idempotent. On very large tables the CREATE INDEX
-- briefly locks the table, so prefer a low-traffic window.

-- Recompute join drivers -----------------------------------------------------
-- Each overlay UPDATE probes `attendance` by (emp, date); the PK is date-first so
-- these emp-first probes can't use it.
CREATE INDEX IF NOT EXISTS idx_att_emp_date ON attendance (att_emp, att_date);

-- COA (attendance change): filtered by coa_ddate range + joined coa_dpk -> coa_sid,
-- coa_semp, coa_sstatus.
CREATE INDEX IF NOT EXISTS idx_coa_detail_date_pk ON coa_detail (coa_ddate, coa_dpk);
CREATE INDEX IF NOT EXISTS idx_coa_summary_emp_status ON coa_summary (coa_semp, coa_sstatus);

-- Overtime: filtered by otm_date range + otm_status, joined by otm_emp.
CREATE INDEX IF NOT EXISTS idx_overtime_date_emp_status ON overtime (otm_date, otm_emp, otm_status);

-- Undertime: filtered by utm_date range + utm_status, joined by utm_emp.
CREATE INDEX IF NOT EXISTS idx_undertime_date_emp_status ON undertime (utm_date, utm_emp, utm_status);

-- Leave: filtered by lea_ddate range + joined lea_dpk -> lea_sid, lea_semp, lea_sstatus.
CREATE INDEX IF NOT EXISTS idx_leave_detail_date_pk ON leave_detail (lea_ddate, lea_dpk);
CREATE INDEX IF NOT EXISTS idx_leave_summary_emp_status ON leave_summary (lea_semp, lea_sstatus);

-- Schedule adjustment: filtered by sca_ddate range + joined sca_dpk -> sca_sid,
-- sca_semp, sca_sstatus.
CREATE INDEX IF NOT EXISTS idx_schedadjust_detail_date_pk ON schedadjust_detail (sca_ddate, sca_dpk);
CREATE INDEX IF NOT EXISTS idx_schedadjust_summary_emp_status ON schedadjust_summary (sca_semp, sca_sstatus);

-- Read-path filters ----------------------------------------------------------
-- Summary/detail queries filter `AND emp_loc/emp_dept/emp_pos IN (...)`.
CREATE INDEX IF NOT EXISTS idx_employee_dept ON employee (emp_dept);
CREATE INDEX IF NOT EXISTS idx_employee_pos ON employee (emp_pos);
CREATE INDEX IF NOT EXISTS idx_employee_loc ON employee (emp_loc);

-- Schedule module ------------------------------------------------------------
-- The schedule table only has its PK on `sch_id`. Bulk schedule editing and the
-- attendance recompute read/write rows filtered by `sch_emp` (7 rows/employee),
-- which without this index means a full scan per employee across up to 10,000
-- employees. The bulk-apply path also uses `sch_id IN (...)`, covered by the PK.
CREATE INDEX IF NOT EXISTS idx_schedule_emp ON schedule (sch_emp);
