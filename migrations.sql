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
ALTER TABLE orgs ADD COLUMN balance REAL NOT NULL DEFAULT 0;
ALTER TABLE orgs ADD COLUMN charged_through TEXT NOT NULL DEFAULT '';
ALTER TABLE orgs ADD COLUMN bill_from TEXT NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN balance_after REAL;
ALTER TABLE bookings ADD COLUMN pax INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN ext_uid TEXT NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN ext_feed TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS bookings_feed_idx ON bookings(org_id, ext_feed);
ALTER TABLE bookings ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE orgs ADD COLUMN apt_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN extra TEXT NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS msg_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,
  offset_days INTEGER NOT NULL DEFAULT 0,
  send_hour INTEGER NOT NULL DEFAULT 10,
  apts TEXT NOT NULL DEFAULT '[]',
  channels TEXT NOT NULL DEFAULT '[]',
  subject_ro TEXT NOT NULL DEFAULT '',
  subject_ru TEXT NOT NULL DEFAULT '',
  subject_en TEXT NOT NULL DEFAULT '',
  body_ro TEXT NOT NULL DEFAULT '',
  body_ru TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS msg_templates_org_idx ON msg_templates(org_id);
CREATE TABLE IF NOT EXISTS msg_sent (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  template_id TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'email',
  to_addr TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ro',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS msg_sent_booking_idx ON msg_sent(org_id, booking_id, created_at);
