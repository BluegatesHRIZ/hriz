-- Device registration: browsers must be approved before anyone can sign in on them.
--
-- The DB is introspected (no Prisma migration files); this script is what
-- actually adds the columns on the live server (MySQL 5.7). Run once:
--
--   mysql -h <host> -u <user> -p <database> < sql/a11_device_registration.sql
--
-- MySQL 5.7 has no ADD COLUMN IF NOT EXISTS, so a second run fails with
-- "Duplicate column name" and changes nothing.

-- Old triggers forced ter_status = 1 on every insert and update (their
-- `if new.ter_code='CAS001'` guard had been commented out), so every device was
-- approved on arrival and Reject / Unauthorize never stuck. The dev-only CAS001
-- auto-approve now lives in lib/services/device.service.ts. Original bodies,
-- should they ever need restoring:
--   BEGIN
--   -- if new.ter_code='CAS001' then
--     set new.ter_status='1';
--   -- end if;
--   END
DROP TRIGGER IF EXISTS terminal_BEFORE_INSERT;
DROP TRIGGER IF EXISTS terminal_BEFORE_UPDATE;

-- Settings switch: 1 = every sign-in must come from an approved device. -------
ALTER TABLE settings_tab
  ADD COLUMN set_devreg TINYINT NULL DEFAULT 0;

-- A browser that asked to be registered is a `terminal` row (ter_type 0).
-- The browser keeps a private signing key it cannot export; the server keeps
-- the public half and checks a signature at every sign-in.
ALTER TABLE terminal
  ADD COLUMN ter_pubkey   TEXT         NULL COMMENT 'SPKI public key, base64url',
  ADD COLUMN ter_keyid    CHAR(64)     NULL COMMENT 'SHA-256 hex of the public key',
  ADD COLUMN ter_reqemp   VARCHAR(6)   NULL COMMENT 'employee who requested the device',
  ADD COLUMN ter_agent    VARCHAR(255) NULL COMMENT 'browser user agent at request time',
  ADD COLUMN ter_chalts   DATETIME(3)  NULL COMMENT 'issue time of the last sign-in challenge used',
  ADD COLUMN ter_lastseen DATETIME     NULL COMMENT 'last successful sign-in',
  ADD UNIQUE INDEX ux_terminal_keyid (ter_keyid);
