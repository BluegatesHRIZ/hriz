-- Schedule Management module: saved schedule templates + sidebar menu entry.
--
-- The DB is introspected (no Prisma migration files); this script is what
-- actually creates the tables/rows on live MariaDB. Run once:
--
--   mysql -h <host> -u <user> -p <database> < sql/schedule_templates.sql
--
-- Safe to re-run: CREATE TABLE / INSERT use IF NOT EXISTS / ON DUPLICATE.

-- Saved schedule templates ("Morning shift", "Night shift", ...). --------------
CREATE TABLE IF NOT EXISTS scheduletemplate (
  sct_tid      VARCHAR(20)  NOT NULL,
  sct_tname    VARCHAR(60)  NOT NULL,
  sct_tdesc    VARCHAR(150) NULL,
  sct_tby      VARCHAR(6)   NULL,
  sct_tstatus  INT          NULL DEFAULT 1,
  sct_tlogdate DATETIME     NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (sct_tid)
);

-- One row per day of week for a template (same shape as `schedule`). ----------
CREATE TABLE IF NOT EXISTS scheduletemplatedetail (
  sct_did    VARCHAR(40) NOT NULL,
  sct_dpk    VARCHAR(20) NOT NULL,
  sct_dday   VARCHAR(45) NULL,
  sct_din    TIME        NULL,
  sct_dout   TIME        NULL,
  sct_dbin   TIME        NULL,
  sct_dbout  TIME        NULL,
  sct_dhrs   FLOAT       NULL DEFAULT 0,
  sct_drest  INT         NULL DEFAULT 0,
  sct_dshift VARCHAR(2)  NULL DEFAULT 'R',
  sct_dbreak TINYINT     NULL DEFAULT 1,
  PRIMARY KEY (sct_did)
);

CREATE INDEX IF NOT EXISTS idx_scheduletemplatedetail_pk
  ON scheduletemplatedetail (sct_dpk);

-- Sidebar menu entry under Administration (H1). `A*` prefix = admin group; the
-- Sidebar is DB-driven and buckets by the first letter of mnu_id. Permission is
-- granted in code via MENU_TO_PERMISSION_NAMES['A11'] (AccessEmployee | AllAccess).
INSERT INTO menu (mnu_id, mnu_desc, mnu_status, mnu_http, mnu_ctr)
VALUES ('A11', 'Manage Schedules', 1, '/schedules', 11)
ON DUPLICATE KEY UPDATE
  mnu_desc = VALUES(mnu_desc),
  mnu_status = VALUES(mnu_status),
  mnu_http = VALUES(mnu_http),
  mnu_ctr = VALUES(mnu_ctr);
