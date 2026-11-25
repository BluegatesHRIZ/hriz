-- A10 Manage Loans under Administration. The row does not exist on every
-- database, so INSERT it (safe to re-run).
INSERT INTO menu (mnu_id, mnu_desc, mnu_status, mnu_http, mnu_ctr)
VALUES ('A10', 'Manage Loans', 1, '/admin/manage-loans', 10)
ON DUPLICATE KEY UPDATE
  mnu_desc = VALUES(mnu_desc),
  mnu_status = VALUES(mnu_status),
  mnu_http = VALUES(mnu_http),
  mnu_ctr = VALUES(mnu_ctr);
