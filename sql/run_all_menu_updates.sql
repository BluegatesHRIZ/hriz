-- Run this once against your MariaDB to point all sidebar menu entries
-- at the Next.js pages. Safe to re-run (all statements are idempotent).

UPDATE menu SET mnu_http = '/admin/announcements'      WHERE mnu_id = 'A2';
UPDATE menu SET mnu_http = '/admin/holidays'           WHERE mnu_id = 'A3';
UPDATE menu SET mnu_http = '/admin/masterfile'         WHERE mnu_id = 'A4';
UPDATE menu SET mnu_http = '/admin/roles-permissions'  WHERE mnu_id = 'A5';
UPDATE menu SET mnu_http = '/admin/register-device'    WHERE mnu_id = 'A6';
UPDATE menu SET mnu_http = '/admin/settings'           WHERE mnu_id = 'A8';
UPDATE menu SET mnu_http = '/admin/bulk-upload'        WHERE mnu_id = 'A9';
UPDATE menu SET mnu_http = '/admin/manage-loans'       WHERE mnu_id = 'A10';

UPDATE menu SET mnu_http = '/reports/attendance'       WHERE mnu_id = 'R1';
UPDATE menu SET mnu_http = '/reports/leave'            WHERE mnu_id = 'R2';
UPDATE menu SET mnu_http = '/reports/overtime'         WHERE mnu_id = 'R3';
UPDATE menu SET mnu_http = '/reports/payroll'          WHERE mnu_id = 'R4';
UPDATE menu SET mnu_http = '/reports/dailylog'         WHERE mnu_id = 'R5';
UPDATE menu SET mnu_http = '/reports/undertime'        WHERE mnu_id = 'R6';
UPDATE menu SET mnu_http = '/reports/schedule-change'  WHERE mnu_id = 'R7';

SELECT mnu_id, mnu_desc, mnu_http FROM menu ORDER BY mnu_id;
