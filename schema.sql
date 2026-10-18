-- espace.md — multi-tenant schema (Cloudflare D1 / SQLite).
-- Every business table carries org_id; the API never reads or writes a row without it.
-- Idempotent: safe to run on every deploy.

-- ---------- platform ----------
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,             -- the company address: <code>.espace.md (e.g. rentwill)
  status TEXT NOT NULL DEFAULT 'active', -- active | blocked
  trial_ends TEXT NOT NULL,              -- YYYY-MM-DD
  paid_until TEXT NOT NULL DEFAULT '',   -- YYYY-MM-DD, '' = never paid
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  pw_hash TEXT NOT NULL,
  google_sub TEXT UNIQUE,                 -- Google OpenID subject; NULL until linked
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- short-lived OAuth CSRF states (Google login / link)
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager',  -- owner | manager | checker | viewer
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS members_user_idx ON members(user_id);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,        -- lei
  months INTEGER NOT NULL DEFAULT 1,
  paid_until TEXT NOT NULL,              -- what paid_until became after this payment
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS payments_org_idx ON payments(org_id);
CREATE TABLE IF NOT EXISTS auth_fail (k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, until TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS sys_state (k TEXT PRIMARY KEY, v TEXT NOT NULL);

-- ---------- per company (ported from Rentwill, + org_id) ----------
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  date TEXT NOT NULL,
  apt TEXT NOT NULL,
  guest TEXT NOT NULL DEFAULT '',
  nights INTEGER NOT NULL DEFAULT 0,
  mdl REAL NOT NULL DEFAULT 0,
  eur REAL NOT NULL DEFAULT 0,
  usd REAL NOT NULL DEFAULT 0,
  oth REAL NOT NULL DEFAULT 0,
  oth_cur TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  price_cur TEXT NOT NULL DEFAULT 'EUR',
  pay_status TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',
  util REAL NOT NULL DEFAULT 0,
  util_cur TEXT NOT NULL DEFAULT 'MDL',
  pay TEXT NOT NULL DEFAULT '',
  who TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  pax INTEGER NOT NULL DEFAULT 0,          -- number of guests
  email TEXT NOT NULL DEFAULT '',          -- guest email (direct booking requests)
  ext_uid TEXT NOT NULL DEFAULT '',        -- imported from an iCal feed: the event's UID
  ext_feed TEXT NOT NULL DEFAULT '',       -- …and the feed (ical_feeds.id)
  verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  shift_id TEXT,
  shift_adopted INTEGER NOT NULL DEFAULT 0,
  extra TEXT NOT NULL DEFAULT '{}',          -- kids, language, times, team note, deposit, commission (JSON)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS bookings_org_date_idx ON bookings(org_id, date);
CREATE INDEX IF NOT EXISTS bookings_shift_idx ON bookings(shift_id);

-- online guest check-in (public token link)
CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open',
  data TEXT NOT NULL DEFAULT '{}',
  completed_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS checkins_org_idx ON checkins(org_id, booking_id);
CREATE INDEX IF NOT EXISTS checkins_token_idx ON checkins(token);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  date TEXT NOT NULL,
  apt TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  mdl REAL NOT NULL DEFAULT 0,
  eur REAL NOT NULL DEFAULT 0,
  usd REAL NOT NULL DEFAULT 0,
  oth REAL NOT NULL DEFAULT 0,
  oth_cur TEXT NOT NULL DEFAULT '',
  who TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  shift_id TEXT,
  yearly INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS expenses_org_date_idx ON expenses(org_id, date);
CREATE INDEX IF NOT EXISTS expenses_shift_idx ON expenses(shift_id);
CREATE TABLE IF NOT EXISTS handovers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  person TEXT NOT NULL DEFAULT '',
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  rows TEXT NOT NULL DEFAULT '[]',
  cols TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  closed INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS handovers_org_idx ON handovers(org_id);
CREATE TABLE IF NOT EXISTS apt_photos (org_id TEXT NOT NULL, apt TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY (org_id, apt));
CREATE TABLE IF NOT EXISTS app_config (org_id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL DEFAULT '',
  salary REAL NOT NULL DEFAULT 8500,
  extra_rate REAL NOT NULL DEFAULT 150,
  cycle_start TEXT NOT NULL DEFAULT '',
  on_days INTEGER NOT NULL DEFAULT 3,
  off_days INTEGER NOT NULL DEFAULT 3,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS staff_org_idx ON staff(org_id);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  date TEXT NOT NULL,
  apt TEXT NOT NULL,
  staff_id TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  note TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  cost REAL NOT NULL DEFAULT 0,
  booking_id TEXT,
  reported_by TEXT NOT NULL DEFAULT '',
  time TEXT NOT NULL DEFAULT '',
  sent INTEGER NOT NULL DEFAULT 0,
  shift_person TEXT NOT NULL DEFAULT '',
  done_by TEXT NOT NULL DEFAULT '',
  done_shift TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  done_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS tasks_org_date_idx ON tasks(org_id, date);
CREATE INDEX IF NOT EXISTS tasks_booking_idx ON tasks(booking_id);
CREATE TABLE IF NOT EXISTS checks (
  org_id TEXT NOT NULL,
  apt TEXT NOT NULL,
  item TEXT NOT NULL,
  date TEXT NOT NULL,
  staff_id TEXT,
  PRIMARY KEY (org_id, apt, item, date)
);
CREATE TABLE IF NOT EXISTS app_state (org_id TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (org_id, k));
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT '',
  staff_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS push_subs_org_idx ON push_subs(org_id);
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  at TEXT NOT NULL,
  text TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'me',
  sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS reminders_due_idx ON reminders(sent, at);
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  text TEXT NOT NULL,
  apt TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  due_time TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  done INTEGER NOT NULL DEFAULT 0,
  done_by TEXT NOT NULL DEFAULT '',
  done_at TEXT,
  notified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS todos_org_idx ON todos(org_id);
CREATE TABLE IF NOT EXISTS notifs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  target TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS notifs_org_target_idx ON notifs(org_id, target, id);
-- guest guide: one row per apartment ("*" = common for all), public link by random token
CREATE TABLE IF NOT EXISTS guides (org_id TEXT NOT NULL, apt TEXT NOT NULL, token TEXT NOT NULL UNIQUE, data TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL, PRIMARY KEY (org_id, apt));
CREATE TABLE IF NOT EXISTS guide_media (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, apt TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS guide_media_org_apt ON guide_media(org_id, apt);
-- payment check: who checked, when, problems, what the money looked like at that moment
CREATE TABLE IF NOT EXISTS verify_info (
  org_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '',
  who TEXT NOT NULL DEFAULT '',
  at TEXT,
  note TEXT NOT NULL DEFAULT '',
  snap TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (org_id, kind, ref_id)
);
CREATE TABLE IF NOT EXISTS verify_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  action TEXT NOT NULL,
  who TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS month_close (org_id TEXT NOT NULL, ym TEXT NOT NULL, who TEXT NOT NULL DEFAULT '', at TEXT NOT NULL, PRIMARY KEY (org_id, ym));

-- requests left on the espace.md site (shown in the admin panel)
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  apts TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',   -- new | done
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ---------- platform admin ----------
-- invoices sent to companies (printable at /f/<token>)
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  number TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL,                 -- YYYY-MM-DD
  due_at TEXT NOT NULL,
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  months INTEGER NOT NULL DEFAULT 1,
  apts INTEGER NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,          -- lei, total
  status TEXT NOT NULL DEFAULT 'sent',     -- sent | paid | void
  paid_at TEXT NOT NULL DEFAULT '',
  payment_id TEXT NOT NULL DEFAULT '',
  buyer TEXT NOT NULL DEFAULT '{}',        -- snapshot of the company's billing details
  seller TEXT NOT NULL DEFAULT '{}',       -- snapshot of the platform's details
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS invoices_org_idx ON invoices(org_id);
-- what happened on the platform (sign-ups, payments, blocks…)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  kind TEXT NOT NULL,
  org_id TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS events_org_idx ON events(org_id, id);
-- a banner shown in every company's app
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',      -- info | warn
  ends TEXT NOT NULL DEFAULT '',           -- YYYY-MM-DD, '' = until switched off
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- every email the platform sent or would have sent (status: sent | failed | skipped when no mail key is set)
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT '',
  to_addr TEXT NOT NULL,
  subject TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  dedupe TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS emails_org_idx ON emails(org_id, created_at);
-- password reset links (only the hash is kept; valid 1 hour, once)
CREATE TABLE IF NOT EXISTS pw_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- prepaid balance: one row per day taken from a company's balance (see chargeOrg in lib/core.ts)
CREATE TABLE IF NOT EXISTS charges (
  org_id TEXT NOT NULL,
  day TEXT NOT NULL,                       -- YYYY-MM-DD
  apts INTEGER NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,           -- monthly tier price that day
  amount REAL NOT NULL DEFAULT 0,          -- lei taken
  balance_after REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (org_id, day)
);

-- calendar sync: a unit's iCal links from Airbnb / Booking.com / others (see lib/ical.ts)
CREATE TABLE IF NOT EXISTS ical_feeds (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  apt TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'iCal',   -- Airbnb | Booking | Vrbo | Google | iCal
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_sync TEXT NOT NULL DEFAULT '',
  last_ok INTEGER NOT NULL DEFAULT 0,
  last_msg TEXT NOT NULL DEFAULT '',
  last_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ical_feeds_org_idx ON ical_feeds(org_id, apt);

-- Telegram: a manager's chat linked to the espace.md bot (see lib/telegram.ts)
CREATE TABLE IF NOT EXISTS tg_links (
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (org_id, user_id, chat_id)
);
CREATE TABLE IF NOT EXISTS tg_codes (code TEXT PRIMARY KEY, org_id TEXT NOT NULL, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);

-- monthly statements for apartment owners (a snapshot made in the app; the owner opens it at <slug>.espace.md/raport/<token>)
CREATE TABLE IF NOT EXISTS owner_reports (
  token TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  ym TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT '',
  sent_at TEXT NOT NULL DEFAULT '',
  sent_to TEXT NOT NULL DEFAULT '',
  views INTEGER NOT NULL DEFAULT 0,
  viewed_at TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS owner_reports_key ON owner_reports(org_id, owner_id, ym);

-- payouts to apartment owners: one per owner and month, marked in the app after paying
CREATE TABLE IF NOT EXISTS owner_payouts (
  org_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  ym TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT '',        -- bank | cash | card
  note TEXT NOT NULL DEFAULT '',
  paid_on TEXT NOT NULL DEFAULT '',        -- the day the money went out
  by_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (org_id, owner_id, ym)
);

-- who changed what: bookings, expenses, payouts, settings, team (kept ~400 days)
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  user_id TEXT NOT NULL DEFAULT '',
  who TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,              -- booking | expense | owner | settings | team | month | import
  action TEXT NOT NULL,            -- create | update | delete | …
  ref TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}'  -- {field: [old, new]} or a snapshot
);
CREATE INDEX IF NOT EXISTS audit_org_idx ON audit(org_id, id);
CREATE INDEX IF NOT EXISTS audit_ref_idx ON audit(org_id, ref);

-- rental contracts signed by guests (see lib/contract.ts); one per booking
CREATE TABLE IF NOT EXISTS contracts (
  token TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  number TEXT NOT NULL DEFAULT '',
  texts TEXT NOT NULL DEFAULT '{}',      -- {ro, ru, en} with company and booking details filled in
  status TEXT NOT NULL DEFAULT 'sent',   -- sent | signed
  lang TEXT NOT NULL DEFAULT '',
  guest_name TEXT NOT NULL DEFAULT '',
  guest_doc TEXT NOT NULL DEFAULT '',
  guest_country TEXT NOT NULL DEFAULT '',
  guest_pax INTEGER NOT NULL DEFAULT 0,
  signed_text TEXT NOT NULL DEFAULT '',
  signature TEXT NOT NULL DEFAULT '',    -- PNG data URL drawn by the guest
  signed_at TEXT NOT NULL DEFAULT '',
  signed_ip TEXT NOT NULL DEFAULT '',
  signed_ua TEXT NOT NULL DEFAULT '',
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS contracts_booking ON contracts(org_id, booking_id);

-- card / MIA top-ups through maib Checkout: one row per payment attempt (id = the order id sent to maib)
CREATE TABLE IF NOT EXISTS maib_payments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',     -- new | paid | failed
  checkout_id TEXT NOT NULL DEFAULT '',
  payment_id TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT '',
  card TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS maib_payments_org_idx ON maib_payments(org_id, created_at);

-- invoices issued by a company to its guests (printable at /factura/<token>); separate from platform invoices at /f/
CREATE TABLE IF NOT EXISTS guest_invoices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  booking_id TEXT NOT NULL DEFAULT '',
  number TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MDL',
  lang TEXT NOT NULL DEFAULT 'ro',
  status TEXT NOT NULL DEFAULT 'sent',     -- sent | paid | void
  paid_at TEXT NOT NULL DEFAULT '',
  buyer TEXT NOT NULL DEFAULT '{}',
  seller TEXT NOT NULL DEFAULT '{}',
  lines TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  vat INTEGER NOT NULL DEFAULT 0,
  vat_rate REAL NOT NULL DEFAULT 20,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS guest_invoices_org_number ON guest_invoices(org_id, number);
CREATE INDEX IF NOT EXISTS guest_invoices_org_bk ON guest_invoices(org_id, booking_id);
CREATE INDEX IF NOT EXISTS guest_invoices_token_idx ON guest_invoices(token);

-- promo / discount codes for the public booking page (percent or fixed sum)
CREATE TABLE IF NOT EXISTS discount_codes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  code TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'pct',       -- pct | sum
  value REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT '',
  from_date TEXT NOT NULL DEFAULT '',
  to_date TEXT NOT NULL DEFAULT '',
  max_uses INTEGER NOT NULL DEFAULT 0,    -- 0 = unlimited
  used_count INTEGER NOT NULL DEFAULT 0,
  apts TEXT NOT NULL DEFAULT '[]',        -- JSON list of unit names; empty = all
  active INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_org_code ON discount_codes(org_id, code);

-- prices and rules per unit per day, set from the calendar (price mode) or in bulk: overrides the unit's price, seasons and weekend %
CREATE TABLE IF NOT EXISTS day_rates (
  org_id TEXT NOT NULL,
  apt TEXT NOT NULL,
  day TEXT NOT NULL,                      -- YYYY-MM-DD, the night that starts this day
  price REAL,                             -- NULL = the usual price
  min INTEGER NOT NULL DEFAULT 0,         -- min nights for a stay arriving this day (0 = usual)
  cta INTEGER NOT NULL DEFAULT 0,         -- no arrival this day
  ctd INTEGER NOT NULL DEFAULT 0,         -- no departure this day
  closed INTEGER NOT NULL DEFAULT 0,      -- not for sale
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (org_id, apt, day)
);

-- guest messaging (module 7): automated + manual emails to guests
CREATE TABLE IF NOT EXISTS msg_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,                  -- new | before_in | on_in | before_out | after_out | cancel
  offset_days INTEGER NOT NULL DEFAULT 0,
  send_hour INTEGER NOT NULL DEFAULT 10,  -- 0–23 Europe/Chisinau
  apts TEXT NOT NULL DEFAULT '[]',        -- JSON list of unit names; [] = all
  channels TEXT NOT NULL DEFAULT '[]',    -- JSON list of sources; [] = all
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
