-- Columns added after the first release. Each line runs on its own; "duplicate column" errors are expected and ignored.
ALTER TABLE orgs ADD COLUMN custom_price REAL NOT NULL DEFAULT 0;
ALTER TABLE orgs ADD COLUMN billing TEXT NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN last_login TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN support INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN note TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN follow_up TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN org_id TEXT NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN invoice_id TEXT NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN method TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN terms_at TEXT NOT NULL DEFAULT '';
