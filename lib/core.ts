// espace.md — shared helpers: D1 access, hashing, sessions, roles, subscription tiers.

export interface Env {
  DB: D1Database;
  SUPERADMIN_EMAIL?: string; // the platform owner; sees every company in /admin
  CRON_KEY?: string;         // secret for the every-few-minutes reminders ping
  RESEND_API_KEY?: string;   // emails (resend.com); without it emails are only logged
  MAIL_FROM?: string;        // e.g. "espace.md <noreply@espace.md>"
  MAIL_REPLY_TO?: string;    // where replies go, e.g. the owner's inbox
  TELEGRAM_BOT_TOKEN?: string; // the espace.md bot: managers link their Telegram and get the app's notifications there
  TELEGRAM_API?: string;       // only for local tests: a fake Telegram API address
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const nowIso = () => new Date().toISOString();
export const uuid = () => crypto.randomUUID();

export const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; };
export const str = (v: unknown, max = 500) => (typeof v === "string" ? v : v == null ? "" : String(v)).slice(0, max).trim();
export const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
export const snum = (v: unknown) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export const all = async (db: D1Database, sql: string, ...p: unknown[]) => ((await db.prepare(sql).bind(...p).all()).results || []) as any[];
export const one = async (db: D1Database, sql: string, ...p: unknown[]) => (await db.prepare(sql).bind(...p).first()) as any;
export const run = (db: D1Database, sql: string, ...p: unknown[]) => db.prepare(sql).bind(...p).run();

const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
export async function sha256hex(s: string) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
export function sameStr(a: string, b: string) { // constant-time compare
  if (a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
export const randHex = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)));
export function randCode(n: number) { const a = "abcdefghijkmnpqrstuvwxyz23456789"; return [...crypto.getRandomValues(new Uint8Array(n))].map((b) => a[b % a.length]).join(""); }

// maid PINs (short, typed on the phone): salted sha256, as in Rentwill
export async function hashPin(pin: string, salt?: string) { salt = salt || randHex(8); return salt + ":" + (await sha256hex(salt + pin)); }
export async function pinMatches(pin: string, stored: string) { return !!stored && sameStr(await hashPin(pin, stored.split(":")[0]), stored); }

// account passwords: PBKDF2-SHA256, 100k rounds (the Workers maximum)
export async function hashPassword(pw: string, saltHex?: string) {
  const salt = saltHex || randHex(16);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256);
  return "pbkdf2$" + salt + "$" + hex(bits);
}
export async function passwordMatches(pw: string, stored: string) {
  const [kind, salt] = String(stored || "").split("$");
  if (kind !== "pbkdf2" || !salt) return false;
  return sameStr(await hashPassword(pw, salt), stored);
}

// brute-force brake: after 10 misses the key is locked for 15 minutes
export async function throttled(db: D1Database, k: string) {
  const r = await one(db, "SELECT n, until FROM auth_fail WHERE k = ?", k);
  return !!(r && r.until && r.until > nowIso());
}
export async function failHit(db: D1Database, k: string) {
  await run(db, "INSERT INTO auth_fail(k, n, until) VALUES (?, 1, '') ON CONFLICT (k) DO UPDATE SET n = n + 1", k);
  const r = await one(db, "SELECT n FROM auth_fail WHERE k = ?", k);
  if (r && r.n >= 10) await run(db, "UPDATE auth_fail SET n = 0, until = ? WHERE k = ?", new Date(Date.now() + 15 * 60000).toISOString(), k);
}
export const failClear = (db: D1Database, k: string) => run(db, "DELETE FROM auth_fail WHERE k = ?", k);

// ---------- sessions ----------
export const SESSION_DAYS = 90;
export async function newSession(db: D1Database, userId: string, orgId: string) {
  const token = randHex(32);
  await run(db, "INSERT INTO sessions(token_hash, user_id, org_id, expires_at) VALUES (?,?,?,?)",
    await sha256hex(token), userId, orgId, new Date(Date.now() + SESSION_DAYS * 86400000).toISOString());
  return token;
}
export function bearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  return /^Bearer [0-9a-f]{64}$/.test(h) ? h.slice(7) : "";
}
export type Ctx = { user: any; org: any | null; role: string; tokenHash: string; isSuper: boolean; support: boolean };
export async function loadSession(db: D1Database, env: Env, token: string): Promise<Ctx | null> {
  if (!token) return null;
  const th = await sha256hex(token);
  const s = await one(db, "SELECT * FROM sessions WHERE token_hash = ?", th);
  if (!s || s.expires_at < nowIso()) return null;
  const user = await one(db, "SELECT id, email, name FROM users WHERE id = ?", s.user_id);
  if (!user) return null;
  let org = null, role = "";
  const isSuper = !!env.SUPERADMIN_EMAIL && user.email === env.SUPERADMIN_EMAIL.trim().toLowerCase();
  const support = !!s.support;
  if (support && !isSuper) return null;
  if (s.org_id) {
    // a support session (opened by the platform owner from the admin panel) sees the company read-only
    const m = support ? { role: "viewer" } : await one(db, "SELECT role FROM members WHERE org_id = ? AND user_id = ?", s.org_id, user.id);
    if (m) { org = await chargeOrg(db, await one(db, "SELECT * FROM orgs WHERE id = ?", s.org_id)); role = m.role; }
  }
  return { user, org, role, tokenHash: th, isSuper, support };
}

// ---------- roles ----------
// prop: only their own apartments (PROP_FNS); owner: everything + team; manager: everything but team; checker: read + payment checks; viewer: read only
export const ROLES = ["owner", "manager", "checker", "viewer", "prop"];
// prop: an apartment owner the company works for — sees only their own apartments, through /proprietar
export const PROP_FNS = ["kv_prop_load"];
export const READ_FNS = ["kv_load", "kv_photos", "kv_guides", "kv_task_photo", "kv_push_key", "kv_push_sub", "excel", "excel_handovers", "billing", "kv_ical_list", "kv_tg_status", "kv_tg_link", "kv_tg_unlink", "kv_owner_reports"];
export const CHECKER_FNS = ["kv_verify", "kv_month_close", "kv_month_open"];
export function roleAllows(role: string, fn: string) {
  if (role === "owner") return true;
  if (role === "prop") return PROP_FNS.includes(fn);
  if (fn.startsWith("team_")) return false;
  if (role === "manager") return true;
  if (READ_FNS.includes(fn)) return true;
  return role === "checker" && CHECKER_FNS.includes(fn);
}

// ---------- subscription ----------
// monthly price in lei by number of apartments (the RealtyCalendar-style steps); 71+ = individual
export const TIERS: [number, number, number][] = [[1, 4, 199], [5, 7, 299], [8, 11, 399], [12, 15, 499], [16, 20, 599], [21, 30, 799], [31, 70, 1199]];
export const TRIAL_DAYS = 14;
export function tierFor(n: number) {
  const t = TIERS.find(([, hi]) => n <= hi);
  return t ? { from: t[0], to: t[1], price: t[2] } : { from: 71, to: null, price: null };
}
export const today = () => nowIso().slice(0, 10);
export const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
export function addMonths(d: string, n: number) {
  const [y, m, dd] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(dd, last));
  return t.toISOString().slice(0, 10);
}
// ---------- prepaid balance ----------
// The company tops up its balance (orgs.balance, lei); every day the day's share of the monthly tier price is taken:
// daily = monthly × 12 / 365, e.g. 199 lei/month → 6,54 lei/day. No balance for today → read-only until the next top-up.
// Free days: up to trial_ends, and up to paid_until (time paid before the balance system). Days charged: up to charged_through.
export const dailyRate = (monthly: number) => Math.round((monthly * 12 / 365) * 100) / 100;
const maxStr = (...a: string[]) => a.map((x) => x || "").sort().pop() || "";
export const freeUntil = (org: any) => maxStr(org.trial_ends, org.paid_until);
export const coveredUntil = (org: any) => maxStr(freeUntil(org), org.charged_through);
export function activeUntil(org: any) { return coveredUntil(org); }
export function isExpired(org: any) { return org.status === "blocked" || coveredUntil(org) < today(); }
export async function aptCount(db: D1Database, orgId: string) {
  const c = await one(db, "SELECT data FROM app_config WHERE org_id = ?", orgId);
  try { return c ? (JSON.parse(c.data).apts || []).length : 0; } catch { return 0; }
}
export async function priceOf(db: D1Database, org: any) {
  const apts = await aptCount(db, org.id), tier = tierFor(apts);
  const custom = Number(org.custom_price) > 0 ? Number(org.custom_price) : 0;
  const price = custom || tier.price;
  return { apts, tier, custom: !!custom, price, daily: price == null ? null : dailyRate(price) };
}
// takes today's fee (and any day the cron missed while the balance was enough); returns the org row as it is now
export async function chargeOrg(db: D1Database, org: any): Promise<any> {
  const t = today();
  if (!org || org.status === "blocked" || coveredUntil(org) >= t) return org;
  const p = await priceOf(db, org);
  if (p.daily == null) return org; // 71+ without an individual price yet: nothing to take
  let d = maxStr(addDays(coveredUntil(org) || addDays(t, -1), 1), org.bill_from);
  if (d < addDays(t, -31)) d = addDays(t, -31);
  for (let i = 0; d <= t && i < 32; i++, d = addDays(d, 1)) {
    const r = await one(db, "UPDATE orgs SET balance = ROUND(balance - ?, 2), charged_through = ? WHERE id = ? AND charged_through < ? AND balance >= ? RETURNING balance",
      p.daily, d, org.id, d, p.daily);
    if (!r) break;
    await run(db, "INSERT OR IGNORE INTO charges(org_id, day, apts, price, amount, balance_after) VALUES (?,?,?,?,?,?)", org.id, d, p.apts, p.price, p.daily, r.balance);
  }
  return (await one(db, "SELECT * FROM orgs WHERE id = ?", org.id)) || org;
}
// adds money to the balance; if the company is read-only now, charging restarts today (unfunded days are never taken later)
export async function topUp(db: D1Database, org: any, amount: number, fields: { note?: string; method?: string; invoiceId?: string } = {}) {
  const pid = uuid(), restart = coveredUntil(org) < today();
  const r = await one(db, `UPDATE orgs SET balance = ROUND(balance + ?, 2), status = CASE WHEN status = 'blocked' THEN status ELSE 'active' END${restart ? ", bill_from = ?" : ""} WHERE id = ? RETURNING balance`,
    ...(restart ? [amount, today(), org.id] : [amount, org.id]));
  await run(db, "INSERT INTO payments(id, org_id, amount, months, paid_until, note, method, invoice_id, balance_after) VALUES (?,?,?,0,'',?,?,?,?)",
    pid, org.id, amount, fields.note || "", fields.method || "", fields.invoiceId || "", r.balance);
  const now = await chargeOrg(db, await one(db, "SELECT * FROM orgs WHERE id = ?", org.id));
  const b = await billingOf(db, now);
  return { payment_id: pid, balance: b.balance, active_until: b.active_until, days_left: b.days_left };
}
export async function billingOf(db: D1Database, org: any) {
  const p = await priceOf(db, org), t = today();
  const balance = Math.round((Number(org.balance) || 0) * 100) / 100;
  const covered = coveredUntil(org), expired = isExpired(org);
  // how far the balance reaches after the days already covered
  const daysPaid = p.daily ? Math.floor(balance / p.daily + 1e-9) : 0;
  const until = expired ? covered : (p.daily ? addDays(covered, daysPaid) : "");
  return {
    apts: p.apts, tier: p.tier, price: p.price, custom: p.custom, daily: p.daily, balance, status: org.status,
    trial_ends: org.trial_ends, in_trial: (org.trial_ends || "") >= t, expired, active_until: until, covered_until: covered,
    days_left: until ? Math.round((Date.parse(until + "T00:00:00Z") - Date.parse(t + "T00:00:00Z")) / 86400000) : 9999,
  };
}

// a fresh company starts with one apartment and the owner as the only manager
export function starterConfig(ownerName: string) {
  return {
    rates: { eur: 20, usd: 0.85 },
    apts: ["Квартира 1"],
    people: [ownerName.slice(0, 20) || "Я"],
    pays: ["Кэш", "Счёт", "Airbnb", "Счёт+Кэш"],
    sources: ["Booking", "Airbnb", "Instagram", "Viber/Telegram", "Прямой", "Повторный"],
    categories: ["Коммунальные", "Уборка", "Ремонт", "Бельё и химия", "Комиссии", "Прочее"],
    other: [{ code: "RON", rate: 0.2 }],
  };
}


// ---------- prices by season and weekday (same rules in public/app.html and public/book.html) ----------
// cfg.pricing = { weekend: % extra for Friday/Saturday nights, seasons: [{ name, from: "MM-DD", to: "MM-DD", pct, min }] }
export function seasonOf(pricing: any, date: string) {
  const md = date.slice(5);
  return (pricing?.seasons || []).find((s: any) => s.from && s.to && (s.from <= s.to ? md >= s.from && md <= s.to : md >= s.from || md <= s.to)) || null;
}
export function nightPrice(base: number, date: string, pricing: any) {
  let p = +base || 0;
  const s = seasonOf(pricing, date); if (s) p *= 1 + (+s.pct || 0) / 100;
  const wd = new Date(date + "T00:00:00Z").getUTCDay(); if ((wd === 5 || wd === 6) && +pricing?.weekend) p *= 1 + +pricing.weekend / 100;
  return Math.round(p * 100) / 100;
}
export function stayPrice(base: number, date: string, nights: number, pricing: any) {
  let t = 0; for (let i = 0; i < nights; i++) t += nightPrice(base, addDays(date, i), pricing);
  return Math.round(t * 100) / 100;
}
export function minNights(pricing: any, date: string, fallback = 1) { const s = seasonOf(pricing, date); return Math.max(1, +(s?.min) || +fallback || 1); }
