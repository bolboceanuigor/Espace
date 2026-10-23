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
CREATE TABLE IF NOT EXISTS booking_files (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, booking_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', mime TEXT NOT NULL DEFAULT '', size INTEGER NOT NULL DEFAULT 0, r2_key TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS booking_files_bk_idx ON booking_files(org_id, booking_id);
ALTER TABLE booking_files ADD COLUMN data TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS errors (id TEXT PRIMARY KEY, org_id TEXT NOT NULL DEFAULT '', fn TEXT NOT NULL DEFAULT '', status INTEGER NOT NULL DEFAULT 500, message TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS errors_created_idx ON errors(created_at);
ALTER TABLE users ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_uidx ON users(google_sub);
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
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
CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', phone_norm TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', email_norm TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', flag TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS contacts_org_idx ON contacts(org_id, updated_at);
CREATE INDEX IF NOT EXISTS contacts_phone_idx ON contacts(org_id, phone_norm);
CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts(org_id, email_norm);
CREATE TABLE IF NOT EXISTS checkins (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, booking_id TEXT NOT NULL, token TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'open', data TEXT NOT NULL DEFAULT '{}', completed_at TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS checkins_org_idx ON checkins(org_id, booking_id);
CREATE INDEX IF NOT EXISTS checkins_token_idx ON checkins(token);
CREATE TABLE IF NOT EXISTS guest_invoices (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, booking_id TEXT NOT NULL DEFAULT '', number TEXT NOT NULL, token TEXT NOT NULL UNIQUE, issued_at TEXT NOT NULL, due_at TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'MDL', lang TEXT NOT NULL DEFAULT 'ro', status TEXT NOT NULL DEFAULT 'sent', paid_at TEXT NOT NULL DEFAULT '', buyer TEXT NOT NULL DEFAULT '{}', seller TEXT NOT NULL DEFAULT '{}', lines TEXT NOT NULL DEFAULT '[]', note TEXT NOT NULL DEFAULT '', vat INTEGER NOT NULL DEFAULT 0, vat_rate REAL NOT NULL DEFAULT 20, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE UNIQUE INDEX IF NOT EXISTS guest_invoices_org_number ON guest_invoices(org_id, number);
CREATE INDEX IF NOT EXISTS guest_invoices_org_bk ON guest_invoices(org_id, booking_id);
CREATE INDEX IF NOT EXISTS guest_invoices_token_idx ON guest_invoices(token);
CREATE TABLE IF NOT EXISTS discount_codes (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, code TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'pct', value REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT '', from_date TEXT NOT NULL DEFAULT '', to_date TEXT NOT NULL DEFAULT '', max_uses INTEGER NOT NULL DEFAULT 0, used_count INTEGER NOT NULL DEFAULT 0, apts TEXT NOT NULL DEFAULT '[]', active INTEGER NOT NULL DEFAULT 1, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_org_code ON discount_codes(org_id, code);
ALTER TABLE members ADD COLUMN apts TEXT NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN sections TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN totp_secret TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN totp_pending TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN totp_backup TEXT NOT NULL DEFAULT '[]';
CREATE TABLE IF NOT EXISTS totp_chal (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, org_id TEXT NOT NULL DEFAULT '', expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS totp_chal_user_idx ON totp_chal(user_id);
ALTER TABLE sessions ADD COLUMN id TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN ua TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN ip TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN last_seen TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_uidx ON users(google_sub);
ALTER TABLE users ADD COLUMN totp_secret TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN totp_pending TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN totp_backup TEXT NOT NULL DEFAULT '[]';
CREATE TABLE IF NOT EXISTS totp_chal (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, org_id TEXT NOT NULL DEFAULT '', expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS totp_chal_user_idx ON totp_chal(user_id);
ALTER TABLE members ADD COLUMN apts TEXT NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN sections TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS oauth_states (state TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at TEXT NOT NULL);
