// espace.md — the platform owner's panel (admin.espace.md): metrics, companies, invoices, leads, activity, announcements, settings.
import {
  type Ctx, json, uuid, num, str, isDate, isEmail, all, one, run, randCode, newSession,
  today, addDays, addMonths, activeUntil, coveredUntil, globalRate, RATE_DEFAULT, topUp, billingOf, sha256hex, hashPassword, starterConfig, randHex, failClear, nowIso, chargeOrg,
} from "./core";
import { slugOk } from "./host";
import { sendMail, mails, orgEmail, orgUrl, broadcastMail } from "./mail";
import type { Env } from "./core";

export async function logEvent(db: D1Database, kind: string, orgId: string, actor: string, text: string) {
  await run(db, "INSERT INTO events(kind, org_id, actor, text) VALUES (?,?,?,?)", kind, orgId || "", actor || "", text.slice(0, 500)).catch(() => {});
}

export const SELLER_DEFAULT = {
  name: "", idno: "", vat_code: "", address: "", bank: "", iban: "", bic: "", email: "", phone: "",
  vat: false, vat_rate: 20, prefix: "ESP", due_days: 5, footer: "",
  apt_rate: 1, // credits (lei) per unit per day, for every company without its own rate
};
export async function getSettings(db: D1Database) {
  const r = await one(db, "SELECT v FROM sys_state WHERE k = 'seller'");
  let v: any = {}; try { v = r ? JSON.parse(r.v) : {}; } catch {}
  return { ...SELLER_DEFAULT, ...v };
}
export async function activeAnnouncement(db: D1Database) {
  return one(db, "SELECT id, text, level, ends FROM announcements WHERE active = 1 AND (ends = '' OR ends >= ?) ORDER BY created_at DESC LIMIT 1", today()).catch(() => null);
}

const monthKey = (d: string) => d.slice(0, 7);
// credits the platform owner adds or takes by hand: on the balance, but not money received
const ADJ = ["bonus", "corectie"], ADJ_SQL = "('bonus','corectie')";
// every table that holds a company's data (export and delete)
const ORG_TABLES = ["bookings", "expenses", "handovers", "apt_photos", "app_config", "staff", "tasks", "checks", "app_state", "push_subs", "reminders", "todos", "notifs",
  "guides", "guide_media", "verify_info", "verify_log", "month_close", "invoices", "events", "emails", "charges", "ical_feeds", "tg_links", "tg_codes", "owner_reports",
  "owner_payouts", "audit", "contracts", "maib_payments", "day_rates", "payments", "members", "sessions"];
const NO_EXPORT = ["push_subs", "tg_codes", "tg_links", "sessions", "members"];
const ROLES_SA = ["owner", "manager", "checker", "viewer"];
const isSuperEmail = (env: Env, e: string) => !!env.SUPERADMIN_EMAIL && e === env.SUPERADMIN_EMAIL.trim().toLowerCase();
function lastMonths(n: number) {
  const out: string[] = []; const t = today();
  for (let i = n - 1; i >= 0; i--) out.push(addMonths(t.slice(0, 7) + "-01", -i).slice(0, 7));
  return out;
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

// one pass over every company with everything the panel shows about it
async function orgRows(db: D1Database) {
  const [orgs, cfgs, members, owners, lastB, lastE, lastH, lastT, b30, logins, pays, staff] = await Promise.all([
    all(db, "SELECT * FROM orgs ORDER BY created_at DESC"),
    all(db, "SELECT org_id, data FROM app_config"),
    all(db, "SELECT org_id, COUNT(*) AS n FROM members GROUP BY org_id"),
    all(db, "SELECT m.org_id, u.name, u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.role = 'owner' ORDER BY m.created_at"),
    all(db, "SELECT org_id, MAX(updated_at) AS t FROM bookings GROUP BY org_id"),
    all(db, "SELECT org_id, MAX(updated_at) AS t FROM expenses GROUP BY org_id"),
    all(db, "SELECT org_id, MAX(updated_at) AS t FROM handovers GROUP BY org_id"),
    all(db, "SELECT org_id, MAX(updated_at) AS t FROM tasks GROUP BY org_id"),
    all(db, "SELECT org_id, COUNT(*) AS n FROM bookings WHERE created_at >= ? GROUP BY org_id", addDays(today(), -30)),
    all(db, "SELECT m.org_id, MAX(u.last_login) AS t FROM members m JOIN users u ON u.id = m.user_id GROUP BY m.org_id"),
    all(db, `SELECT org_id, SUM(amount) AS total, COUNT(*) AS n, MIN(created_at) AS first FROM payments WHERE method NOT IN ${ADJ_SQL} GROUP BY org_id`),
    all(db, "SELECT org_id, COUNT(*) AS n FROM staff WHERE active = 1 GROUP BY org_id"),
  ]);
  const by = (rows: any[], f = "n") => Object.fromEntries(rows.map((r) => [r.org_id, r[f]]));
  const apts: Record<string, number> = {};
  for (const c of cfgs) { try { apts[c.org_id] = (JSON.parse(c.data).apts || []).length; } catch { apts[c.org_id] = 0; } }
  const own: Record<string, any> = {}; for (const o of owners) if (!own[o.org_id]) own[o.org_id] = o;
  const mem = by(members), bb = by(b30), lg = by(logins, "t"), st = by(staff);
  const last: Record<string, string> = {};
  for (const rows of [lastB, lastE, lastH, lastT]) for (const r of rows) if (r.t && (!last[r.org_id] || r.t > last[r.org_id])) last[r.org_id] = r.t;
  const pay: Record<string, any> = Object.fromEntries(pays.map((p) => [p.org_id, p]));
  const t = today();
  const gRate = await globalRate(db);
  return orgs.map((o) => {
    const n = apts[o.id] || 0, ownRate = Number(o.apt_rate) > 0 ? Number(o.apt_rate) : 0, rate = ownRate || gRate;
    const daily = Math.round(n * rate * 100) / 100, price = Math.round(daily * 30 * 100) / 100, balance = Math.round((Number(o.balance) || 0) * 100) / 100;
    const covered = coveredUntil(o), funded = covered >= t && o.status !== "blocked";
    // how far the balance reaches after the days already covered (trial, old paid time, days taken)
    const until = funded && daily ? addDays(covered, Math.floor(balance / daily + 1e-9)) : covered;
    const state = o.status === "blocked" ? "blocked" : !funded ? "expired" : (o.trial_ends || "") >= t ? "trial" : "paid";
    let billing: any = {}; try { billing = JSON.parse(o.billing || "{}"); } catch {}
    return {
      id: o.id, name: o.name, code: o.code, status: o.status, state, note: o.note, created_at: o.created_at,
      trial_ends: o.trial_ends, paid_until: o.paid_until, active_until: until, days_left: daysBetween(t, until || t),
      apts: n, price, daily, balance, rate, apt_rate: ownRate, charged_through: o.charged_through || "",
      members: mem[o.id] || 0, staff: st[o.id] || 0, bookings_30d: bb[o.id] || 0,
      last_activity: last[o.id] || "", last_login: lg[o.id] || "",
      owner_name: own[o.id]?.name || "", owner_email: own[o.id]?.email || "",
      paid_total: pay[o.id]?.total || 0, payments: pay[o.id]?.n || 0, first_payment: pay[o.id]?.first || "",
      billing,
    };
  });
}

async function overview(db: D1Database) {
  const orgs = await orgRows(db);
  const t = today(), d30 = addDays(t, -30);
  const paying = orgs.filter((o) => o.state === "paid"), trial = orgs.filter((o) => o.state === "trial");
  // MRR: what the companies being charged right now pay per month (their daily fee × 365 / 12)
  const mrr = paying.reduce((s, o) => s + (o.daily ? Math.round(o.daily * 365 / 12) : 0), 0);
  // trial → paid: companies whose 14 days are over, and how many of them ever topped up
  const matured = orgs.filter((o) => (o.trial_ends || "") < t);
  const converted = matured.filter((o) => o.payments > 0).length;
  // churn: paying customers whose balance ran out in the last 30 days
  const lapsed = orgs.filter((o) => o.payments > 0 && o.state === "expired" && (o.active_until || "") >= d30);
  const payments = await all(db, "SELECT * FROM payments ORDER BY created_at DESC");
  // used per month: the daily fees actually taken (top-ups not yet used stay on the balances)
  const months = lastMonths(12);
  const used = await all(db, "SELECT substr(day, 1, 7) AS m, SUM(amount) AS s FROM charges WHERE day >= ? GROUP BY m", months[0] + "-01");
  const usedBy = Object.fromEntries(used.map((r) => [r.m, r.s]));
  const mrrSeries = months.map((m) => Math.round(usedBy[m] || 0));
  const revenue = months.map((m) => Math.round(payments.filter((p) => monthKey(p.created_at) === m && !ADJ.includes(p.method)).reduce((s, p) => s + (p.amount || 0), 0)));
  // sign-ups per week, last 12 weeks
  const weeks: string[] = []; for (let i = 11; i >= 0; i--) weeks.push(addDays(t, -7 * i - 6));
  const signups = weeks.map((w) => orgs.filter((o) => o.created_at.slice(0, 10) >= w && o.created_at.slice(0, 10) <= addDays(w, 6)).length);
  const leads = await all(db, "SELECT * FROM leads ORDER BY created_at DESC");
  const invoices = await all(db, "SELECT i.*, o.name AS org_name FROM invoices i LEFT JOIN orgs o ON o.id = i.org_id WHERE i.status = 'sent' ORDER BY i.due_at");
  // what needs the owner today
  const attention: any[] = [];
  for (const o of orgs) {
    if (o.state === "trial" && o.days_left <= 3) attention.push({ kind: "trial_end", org_id: o.id, name: o.name, days: o.days_left, price: o.price });
    if ((o.state === "paid" || o.state === "trial" && o.payments > 0) && o.days_left <= 7) attention.push({ kind: "renewal", org_id: o.id, name: o.name, days: o.days_left, price: o.price });
    if (o.state === "expired" && (o.active_until || "") >= addDays(t, -14)) attention.push({ kind: "expired", org_id: o.id, name: o.name, days: o.days_left, price: o.price });
    if (o.state === "paid" && (!o.last_activity || o.last_activity.slice(0, 10) < addDays(t, -14))) attention.push({ kind: "inactive", org_id: o.id, name: o.name, since: o.last_activity });
  }
  for (const l of leads) {
    if (l.status === "new") attention.push({ kind: "lead_new", lead_id: l.id, name: l.name, phone: l.phone, at: l.created_at });
    else if (l.follow_up && l.follow_up <= t && !["won", "lost"].includes(l.status)) attention.push({ kind: "lead_follow", lead_id: l.id, name: l.name, phone: l.phone, date: l.follow_up });
  }
  for (const i of invoices) if (i.due_at < t) attention.push({ kind: "invoice_overdue", invoice_id: i.id, org_id: i.org_id, name: i.org_name, number: i.number, amount: i.amount, days: daysBetween(i.due_at, t) });
  const thisMonth = monthKey(t), lastMonth = addMonths(thisMonth + "-01", -1).slice(0, 7);
  return {
    kpi: {
      mrr, arr: mrr * 12, paying: paying.length, trial: trial.length, companies: orgs.length,
      arpa: paying.length ? Math.round(mrr / paying.length) : 0,
      conversion: matured.length ? Math.round((converted / matured.length) * 100) : null, matured: matured.length,
      churn: paying.length + lapsed.length ? Math.round((lapsed.length / (paying.length + lapsed.length)) * 100) : 0, lapsed: lapsed.length,
      collected_month: revenue[revenue.length - 1], collected_prev: revenue[revenue.length - 2] || 0,
      apts_total: orgs.reduce((s, o) => s + o.apts, 0), balances: Math.round(orgs.reduce((s, o) => s + (o.balance || 0), 0)), unpaid_invoices: invoices.reduce((s, i) => s + (i.amount || 0), 0),
      new_leads: leads.filter((l) => l.status === "new").length, signups_30d: orgs.filter((o) => o.created_at.slice(0, 10) >= d30).length,
      this_month: thisMonth, last_month: lastMonth,
    },
    series: { months, mrr: mrrSeries, revenue, weeks, signups },
    rate: await globalRate(db),
    attention, events: await all(db, "SELECT e.*, o.name AS org_name FROM events e LEFT JOIN orgs o ON o.id = e.org_id ORDER BY e.id DESC LIMIT 25"),
  };
}

async function nextInvoiceNumber(db: D1Database, prefix: string) {
  const y = today().slice(0, 4), k = "inv_seq_" + y;
  await run(db, "INSERT INTO sys_state(k, v) VALUES (?, '0') ON CONFLICT (k) DO NOTHING", k);
  const r = await one(db, "UPDATE sys_state SET v = CAST(v AS INTEGER) + 1 WHERE k = ? RETURNING v", k);
  return `${prefix || "ESP"}-${y}-${String(r.v).padStart(4, "0")}`;
}
// an invoice to top up the balance (months = 0 marks the prepaid kind); used by the admin and by the company itself
export async function createInvoice(db: D1Database, env: Env, org: any, amount: number, opts: { note?: string; send?: boolean; actor?: string } = {}) {
  const s = await getSettings(db), b = await billingOf(db, org);
  let billing: any = {}; try { billing = JSON.parse(org.billing || "{}"); } catch {}
  const issued = today(), due = addDays(issued, Math.max(0, Number(s.due_days) || 5));
  const reach = b.daily ? Math.floor(amount / b.daily) : 0;
  const buyer = { name: org.name, ...billing };
  const id = uuid(), number = await nextInvoiceNumber(db, s.prefix), token = randCode(16);
  await run(db, `INSERT INTO invoices(id, org_id, number, token, issued_at, due_at, period_from, period_to, months, apts, amount, status, buyer, seller, note)
    VALUES (?,?,?,?,?,?,?,?,0,?,?, 'sent', ?,?,?)`, id, org.id, number, token, issued, due, issued, addDays(issued, reach), b.apts, amount, JSON.stringify(buyer), JSON.stringify(s), opts.note || "");
  await logEvent(db, "invoice", org.id, opts.actor || "", `Factura ${number}: suplinire ${amount} lei`);
  let mailed = "";
  if (opts.send !== false) mailed = await sendMail(env, db, { to: buyer.email || await orgEmail(db, org.id), ...mails.invoice(org.name, number, amount, due, `https://espace.md/f/${token}`), kind: "invoice", orgId: org.id, key: "inv:" + id });
  return { id, number, token, mailed, amount, due_at: due };
}
async function paid(db: D1Database, env: Env, org: any, amount: number, actor: string, fields: { note?: string; method?: string; invoiceId?: string }, notify = true) {
  const r = await topUp(db, org, amount, fields);
  await logEvent(db, "payment", org.id, actor, `Suplinire ${amount} lei → sold ${r.balance} lei, activ până ${r.active_until}`);
  if (notify) await sendMail(env, db, { to: await orgEmail(db, org.id), ...mails.paid(org.name, amount, r.balance, r.active_until), kind: "paid", orgId: org.id, key: "paid:" + r.payment_id });
  return r;
}

const LEAD_STATES = ["new", "contacted", "demo", "won", "lost"];
const BILL_FIELDS = ["legal_name", "idno", "vat_code", "address", "email", "phone", "contact"];

export async function handleAdmin(fn: string, body: any, c: Ctx, db: D1Database, env: Env): Promise<Response> {
  const actor = c.user.email;
  switch (fn) {
    case "sa_overview": return json(await overview(db));
    case "sa_orgs": return json({ orgs: await orgRows(db), rate: await globalRate(db) });
    case "sa_leads": return json(await all(db, "SELECT l.*, o.name AS org_name, o.code AS org_code FROM leads l LEFT JOIN orgs o ON o.id = l.org_id ORDER BY l.created_at DESC LIMIT 500"));
    case "sa_lead": {
      const l = await one(db, "SELECT * FROM leads WHERE id = ?", str(body.id, 40));
      if (!l) return json({ message: "not_found" }, 404);
      const status = LEAD_STATES.includes(body.status) ? body.status : (body.status === "done" ? "won" : l.status);
      const note = body.note !== undefined ? str(body.note, 2000) : l.note;
      const follow = body.follow_up !== undefined ? (isDate(body.follow_up) ? body.follow_up : "") : l.follow_up;
      const orgId = body.org_id !== undefined ? str(body.org_id, 40) : l.org_id;
      await run(db, "UPDATE leads SET status = ?, note = ?, follow_up = ?, org_id = ? WHERE id = ?", status, note, follow, orgId, l.id);
      if (status !== l.status) await logEvent(db, "lead", orgId, actor, `Cerere „${l.name}”: ${l.status} → ${status}`);
      return json(true);
    }
    case "sa_lead_add": { // a lead from a call or a meeting, added by hand
      const name = str(body.name, 80); if (!name) return json({ message: "need_name" }, 400);
      const id = uuid();
      await run(db, "INSERT INTO leads(id, name, phone, email, apts, message, lang, status, note, follow_up) VALUES (?,?,?,?,?,?,?,?,?,?)",
        id, name, str(body.phone, 40), str(body.email, 120), str(body.apts, 20), str(body.message, 1500), "", "new", str(body.note, 2000), isDate(body.follow_up) ? body.follow_up : "");
      return json(id);
    }
    case "sa_payments": return json(await all(db, "SELECT p.*, o.name AS org_name, o.code AS org_code FROM payments p LEFT JOIN orgs o ON o.id = p.org_id ORDER BY p.created_at DESC LIMIT 1000"));
    case "sa_invoices": return json(await all(db, "SELECT i.id, i.org_id, i.number, i.token, i.issued_at, i.due_at, i.period_from, i.period_to, i.months, i.apts, i.amount, i.status, i.paid_at, o.name AS org_name, o.code AS org_code FROM invoices i LEFT JOIN orgs o ON o.id = i.org_id ORDER BY i.created_at DESC LIMIT 1000"));
    case "sa_events": {
      const q = str(body.org_id, 40);
      return json(q ? await all(db, "SELECT e.*, o.name AS org_name FROM events e LEFT JOIN orgs o ON o.id = e.org_id WHERE e.org_id = ? ORDER BY e.id DESC LIMIT 300", q)
        : await all(db, "SELECT e.*, o.name AS org_name FROM events e LEFT JOIN orgs o ON o.id = e.org_id ORDER BY e.id DESC LIMIT 300"));
    }
    case "sa_settings": return json(await getSettings(db));
    case "sa_settings_save": {
      const cur = await getSettings(db), v: any = { ...cur };
      for (const k of Object.keys(SELLER_DEFAULT)) if (body[k] !== undefined) {
        const d = (SELLER_DEFAULT as any)[k];
        v[k] = typeof d === "boolean" ? body[k] === true : typeof d === "number" ? Math.max(0, Math.min(k === "apt_rate" ? 1000 : 365, num(body[k]))) : str(body[k], 300);
      }
      if (!(v.apt_rate > 0)) v.apt_rate = RATE_DEFAULT;
      v.prefix = String(v.prefix || "ESP").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "ESP";
      await run(db, "INSERT INTO sys_state(k, v) VALUES ('seller', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v", JSON.stringify(v));
      return json(v);
    }
    case "sa_org_create": { // open a company for a client (after a call): the owner gets an email to set a password
      const name = str(body.org_name, 80), slug = str(body.slug, 40).toLowerCase(), email = str(body.email, 120).trim().toLowerCase(), owner = str(body.owner_name, 60);
      if (!name || !owner) return json({ message: "need_names" }, 400);
      if (!slugOk(slug)) return json({ message: "bad_slug" }, 400);
      if (await one(db, "SELECT 1 AS x FROM orgs WHERE code = ?", slug)) return json({ message: "slug_taken" }, 409);
      if (!isEmail(email)) return json({ message: "bad_email" }, 400);
      let u = await one(db, "SELECT id, pw_hash FROM users WHERE email = ?", email);
      const stmts: D1PreparedStatement[] = [];
      if (!u) {
        u = { id: uuid(), pw_hash: "" };
        stmts.push(db.prepare("INSERT INTO users(id, email, name, pw_hash) VALUES (?,?,?,'')").bind(u.id, email, owner));
      }
      const oid = uuid(), trialDays = Math.max(1, Math.min(90, Math.floor(num(body.trial_days)) || 14));
      stmts.push(
        db.prepare("INSERT INTO orgs(id, name, code, trial_ends) VALUES (?,?,?,?)").bind(oid, name, slug, addDays(today(), trialDays)),
        db.prepare("INSERT INTO members(org_id, user_id, role) VALUES (?,?, 'owner')").bind(oid, u.id),
        db.prepare("INSERT INTO app_config(org_id, data) VALUES (?,?)").bind(oid, JSON.stringify(starterConfig(owner))),
      );
      await db.batch(stmts);
      if (body.lead_id) await run(db, "UPDATE leads SET org_id = ?, status = 'won' WHERE id = ?", oid, str(body.lead_id, 40));
      await logEvent(db, "signup", oid, actor, `Companie creată din admin: ${name} (${slug}.espace.md), proprietar ${email}`);
      let mailed = "";
      if (u.pw_hash) mailed = await sendMail(env, db, { to: email, ...mails.invite("espace.md", name, slug, orgUrl(slug), false), kind: "invite", orgId: oid });
      else {
        const tok = randHex(32);
        await run(db, "INSERT INTO pw_resets(token_hash, user_id, expires_at) VALUES (?,?,?)", await sha256hex(tok), u.id, new Date(Date.now() + 72 * 3600000).toISOString());
        mailed = await sendMail(env, db, { to: email, ...mails.welcome(owner, name, slug, `${orgUrl(slug)}#reset=${tok}`), kind: "welcome", orgId: oid, key: "welcome:" + oid });
      }
      return json({ id: oid, slug, mailed });
    }
    case "sa_emails": return json(await all(db, "SELECT e.id, e.org_id, e.to_addr, e.subject, e.kind, e.status, e.detail, e.created_at, o.name AS org_name FROM emails e LEFT JOIN orgs o ON o.id = e.org_id ORDER BY e.created_at DESC LIMIT 500"));
    case "sa_mail_status": return json({ configured: !!env.RESEND_API_KEY, from: env.MAIL_FROM || "espace.md <noreply@espace.md>" });
    case "sa_anns": return json(await all(db, "SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50"));
    case "sa_ann_save": {
      const text = str(body.text, 400); if (!text) return json({ message: "need_text" }, 400);
      const id = str(body.id, 40) || uuid(), level = body.level === "warn" ? "warn" : "info", ends = isDate(body.ends) ? body.ends : "";
      await run(db, `INSERT INTO announcements(id, text, level, ends, active) VALUES (?,?,?,?,?)
        ON CONFLICT (id) DO UPDATE SET text = excluded.text, level = excluded.level, ends = excluded.ends, active = excluded.active`, id, text, level, ends, body.active === false ? 0 : 1);
      return json(id);
    }
    case "sa_ann_delete": await run(db, "DELETE FROM announcements WHERE id = ?", str(body.id, 40)); return json(true);

    // ---------- people: every account, across companies ----------
    case "sa_users": {
      const now = nowIso();
      const users = await all(db, "SELECT u.id, u.email, u.name, u.created_at, u.last_login, u.disabled, CASE WHEN u.pw_hash = '' THEN 0 ELSE 1 END AS has_pw FROM users u ORDER BY u.created_at DESC LIMIT 3000")
        .catch(() => all(db, "SELECT u.id, u.email, u.name, u.created_at, u.last_login, 0 AS disabled, CASE WHEN u.pw_hash = '' THEN 0 ELSE 1 END AS has_pw FROM users u ORDER BY u.created_at DESC LIMIT 3000"));
      const [mem, ses] = await Promise.all([
        all(db, "SELECT m.user_id, m.role, o.id AS org_id, o.name, o.code FROM members m JOIN orgs o ON o.id = m.org_id ORDER BY m.created_at"),
        all(db, "SELECT user_id, COUNT(*) AS n FROM sessions WHERE expires_at > ? AND support = 0 GROUP BY user_id", now),
      ]);
      const by: Record<string, any[]> = {}; for (const m of mem) (by[m.user_id] ||= []).push({ org_id: m.org_id, name: m.name, code: m.code, role: m.role });
      const sn = Object.fromEntries(ses.map((r) => [r.user_id, r.n]));
      return json(users.map((u) => ({ ...u, orgs: by[u.id] || [], sessions: sn[u.id] || 0, super: isSuperEmail(env, u.email) })));
    }
    case "sa_user_link": { // a fresh link to set a password, by email (for someone who lost access)
      const u = await one(db, "SELECT id, email, pw_hash FROM users WHERE id = ?", str(body.user_id, 40));
      if (!u) return json({ message: "not_found" }, 404);
      const tok = randHex(32), hours = u.pw_hash ? 1 : 72;
      await run(db, "INSERT INTO pw_resets(token_hash, user_id, expires_at) VALUES (?,?,?)", await sha256hex(tok), u.id, new Date(Date.now() + hours * 3600000).toISOString());
      const o = await one(db, "SELECT o.code FROM members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY m.created_at LIMIT 1", u.id);
      const url = (isSuperEmail(env, u.email) ? "https://admin.espace.md/" : o ? orgUrl(o.code) : "https://espace.md/") + "#reset=" + tok;
      await failClear(db, "em:" + u.email);
      const mailed = await sendMail(env, db, { to: u.email, ...(u.pw_hash ? mails.reset(url) : mails.setPassword(u.email, url)), kind: "reset" });
      await logEvent(db, "member", "", actor, `Link de parolă trimis la ${u.email}`);
      return json({ mailed });
    }
    case "sa_user_signout": { // sign the person out on every device
      const u = await one(db, "SELECT id, email FROM users WHERE id = ?", str(body.user_id, 40));
      if (!u) return json({ message: "not_found" }, 404);
      if (isSuperEmail(env, u.email)) return json({ message: "is_super" }, 409);
      const r = await run(db, "DELETE FROM sessions WHERE user_id = ?", u.id);
      await logEvent(db, "member", "", actor, `${u.email}: deconectat de pe toate dispozitivele`);
      return json({ ended: r.meta.changes || 0 });
    }
    case "sa_user_disable": { // switch an account off (or back on): no sign-in, every session ends
      const u = await one(db, "SELECT id, email FROM users WHERE id = ?", str(body.user_id, 40));
      if (!u) return json({ message: "not_found" }, 404);
      if (isSuperEmail(env, u.email)) return json({ message: "is_super" }, 409);
      const off = body.disabled !== false;
      await db.batch([
        db.prepare("UPDATE users SET disabled = ? WHERE id = ?").bind(off ? 1 : 0, u.id),
        ...(off ? [db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id)] : []),
      ]);
      await logEvent(db, "member", "", actor, off ? `Cont suspendat: ${u.email}` : `Cont reactivat: ${u.email}`);
      return json(off);
    }

    // ---------- card top-ups (maib), every attempt ----------
    case "sa_maib": return json(await all(db, `SELECT p.id, p.org_id, p.amount, p.status, p.payment_id, p.method, p.card, p.created_at, p.paid_at, o.name AS org_name, o.code AS org_code, u.email AS user_email
      FROM maib_payments p LEFT JOIN orgs o ON o.id = p.org_id LEFT JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 1000`));

    // ---------- health: what is broken right now ----------
    case "sa_health": {
      const now = Date.now(), d7 = new Date(now - 7 * 86400000).toISOString(), h1 = new Date(now - 3600000).toISOString(), d3 = new Date(now - 3 * 86400000).toISOString();
      const [feeds, feedsN, mailsBad, mailsN, maibBad, cron] = await Promise.all([
        all(db, `SELECT f.id, f.org_id, f.apt, f.source, f.last_sync, f.last_msg, o.name AS org_name FROM ical_feeds f JOIN orgs o ON o.id = f.org_id
          WHERE f.last_ok = 0 AND f.last_sync != '' AND o.status = 'active' ORDER BY f.last_sync DESC LIMIT 200`),
        one(db, "SELECT COUNT(*) AS n FROM ical_feeds f JOIN orgs o ON o.id = f.org_id WHERE o.status = 'active'"),
        all(db, "SELECT e.id, e.org_id, e.to_addr, e.subject, e.kind, e.detail, e.created_at, o.name AS org_name FROM emails e LEFT JOIN orgs o ON o.id = e.org_id WHERE e.status = 'failed' AND e.created_at >= ? ORDER BY e.created_at DESC LIMIT 200", d7),
        one(db, "SELECT COUNT(*) AS n FROM emails WHERE created_at >= ?", d7),
        all(db, `SELECT p.id, p.org_id, p.amount, p.status, p.created_at, o.name AS org_name FROM maib_payments p LEFT JOIN orgs o ON o.id = p.org_id
          WHERE (p.status = 'failed' AND p.created_at >= ?) OR (p.status = 'new' AND p.created_at < ? AND p.created_at >= ?) ORDER BY p.created_at DESC LIMIT 200`, d7, h1, d3),
        one(db, "SELECT v FROM sys_state WHERE k = 'cron_last'"),
      ]);
      let cronLast: any = null; try { cronLast = cron ? JSON.parse(cron.v) : null; } catch {}
      return json({
        cron: cronLast, feeds, feeds_total: feedsN?.n || 0, mails_failed: mailsBad, mails_total: mailsN?.n || 0, maib: maibBad,
        config: { mail: !!env.RESEND_API_KEY, maib: !!((env as any).MAIB_CLIENT_ID && (env as any).MAIB_CLIENT_SECRET), maib_sandbox: !!(env as any).MAIB_SANDBOX, cron: !!env.CRON_KEY, telegram: !!(env as any).TELEGRAM_BOT_TOKEN },
      });
    }

    // ---------- one email to many companies (the owners) ----------
    case "sa_broadcast": {
      const seg = ["all", "trial", "paid", "expired"].includes(body.segment) ? body.segment : "all";
      const subject = str(body.subject, 150).trim(), ro = str(body.text, 6000), ru = str(body.text_ru, 6000);
      const rows = (await orgRows(db)).filter((o) => o.status !== "blocked" && (seg === "all" || o.state === seg));
      const seen = new Set<string>(), to: { email: string; org: string; org_id: string }[] = [];
      for (const o of rows) { const e = (o.owner_email || "").toLowerCase(); if (e && !seen.has(e)) { seen.add(e); to.push({ email: e, org: o.name, org_id: o.id }); } }
      if (body.dry) return json({ count: to.length, sample: to.slice(0, 50) });
      if (!subject || !ro.trim()) return json({ message: "need_text" }, 400);
      const id = str(body.id, 40); if (!/^[a-zA-Z0-9-]{8,40}$/.test(id)) return json({ message: "bad_id" }, 400);
      // sent in rounds of 25 (a request may only call out so many times); the page calls again until nothing is left, and the same id never mails anyone twice
      const done = new Set((await all(db, "SELECT dedupe FROM emails WHERE dedupe LIKE ?", `bc:${id}:%`)).map((r) => String(r.dedupe).slice(id.length + 4)));
      const left = to.filter((r) => !done.has(r.email)), m = broadcastMail(subject, ro, ru);
      let sent = 0, failed = 0;
      for (const r of left.slice(0, 25)) {
        const st = await sendMail(env, db, { to: r.email, ...m, kind: "broadcast", orgId: r.org_id, key: `bc:${id}:${r.email}` });
        if (st === "failed") failed++; else sent++;
      }
      const remaining = Math.max(0, left.length - 25);
      if (!remaining) await logEvent(db, "broadcast", "", actor, `Mesaj „${subject}” către ${to.length} companii (${seg})`);
      return json({ total: to.length, sent, failed, remaining });
    }
  }

  // ---------- one company ----------
  const org = await one(db, "SELECT * FROM orgs WHERE id = ?", str(body.org_id, 40));
  if (!org) return json({ message: "not_found" }, 404);
  const O = org.id;
  switch (fn) {
    case "sa_org": {
      const row = (await orgRows(db)).find((o) => o.id === O);
      const [members, payments, invoices, events, leads] = await Promise.all([
        all(db, "SELECT u.id, u.name, u.email, u.last_login, m.role, m.created_at FROM members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? ORDER BY m.created_at", O),
        all(db, "SELECT * FROM payments WHERE org_id = ? ORDER BY created_at DESC", O),
        all(db, "SELECT id, number, token, issued_at, due_at, period_from, period_to, months, amount, status, paid_at FROM invoices WHERE org_id = ? ORDER BY created_at DESC", O),
        all(db, "SELECT * FROM events WHERE org_id = ? ORDER BY id DESC LIMIT 100", O),
        all(db, "SELECT id, name, status, created_at FROM leads WHERE org_id = ?", O),
      ]);
      const emails = await all(db, "SELECT to_addr, subject, kind, status, created_at FROM emails WHERE org_id = ? ORDER BY created_at DESC LIMIT 50", O);
      const usage = await one(db, `SELECT (SELECT COUNT(*) FROM bookings WHERE org_id = ?) AS bookings, (SELECT COUNT(*) FROM tasks WHERE org_id = ? AND kind IN ('clean','general') AND status = 'done') AS cleanings,
        (SELECT COUNT(*) FROM handovers WHERE org_id = ?) AS shifts, (SELECT COUNT(*) FROM expenses WHERE org_id = ?) AS expenses, (SELECT COUNT(*) FROM guides WHERE org_id = ?) AS guides`, O, O, O, O, O);
      return json({ org: row, members, payments, invoices, events, leads, usage, emails });
    }
    case "sa_pay": { // money received: goes onto the balance
      const amount = Math.round(num(body.amount) * 100) / 100;
      if (!(amount > 0) || amount > 1000000) return json({ message: "bad_amount" }, 400);
      return json(await paid(db, env, org, amount, actor, { note: str(body.note, 300), method: str(body.method, 30) }, body.notify !== false));
    }
    case "sa_status": {
      const st = body.status === "blocked" ? "blocked" : "active";
      await run(db, "UPDATE orgs SET status = ? WHERE id = ?", st, O);
      await logEvent(db, st === "blocked" ? "block" : "unblock", O, actor, st === "blocked" ? "Compania a fost blocată" : "Compania a fost deblocată");
      return json(st);
    }
    case "sa_trial": {
      if (!isDate(body.trial_ends)) return json({ message: "bad_date" }, 400);
      await run(db, "UPDATE orgs SET trial_ends = ? WHERE id = ?", body.trial_ends, O);
      await logEvent(db, "trial", O, actor, `Perioada de probă până la ${body.trial_ends}`);
      return json(body.trial_ends);
    }
    case "sa_slug": {
      const slug = str(body.slug, 40).toLowerCase();
      if (slug === org.code) return json(slug);
      if (!slugOk(slug)) return json({ message: "bad_slug" }, 400);
      if (await one(db, "SELECT 1 AS x FROM orgs WHERE code = ?", slug)) return json({ message: "slug_taken" }, 409);
      await run(db, "UPDATE orgs SET code = ? WHERE id = ?", slug, O);
      await logEvent(db, "slug", O, actor, `Adresa schimbată: ${org.code} → ${slug}`);
      return json(slug);
    }
    case "sa_member_email": { // change a member's sign-in email; the new address gets a link to set a password
      const uid = str(body.user_id, 40), email = str(body.email, 120).trim().toLowerCase();
      if (!isEmail(email)) return json({ message: "bad_email" }, 400);
      const u = await one(db, "SELECT u.id, u.email, u.name FROM members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND u.id = ?", O, uid);
      if (!u) return json({ message: "not_found" }, 404);
      if (u.email === email) return json({ email, mailed: "" });
      if (await one(db, "SELECT 1 AS x FROM users WHERE email = ?", email)) return json({ message: "email_taken" }, 409);
      const tok = randHex(32);
      await db.batch([
        db.prepare("UPDATE users SET email = ? WHERE id = ?").bind(email, u.id),
        db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id),           // signed out everywhere
        db.prepare("UPDATE pw_resets SET used = 1 WHERE user_id = ? AND used = 0").bind(u.id), // old links stop working
        db.prepare("INSERT INTO pw_resets(token_hash, user_id, expires_at) VALUES (?,?,?)").bind(await sha256hex(tok), u.id, new Date(Date.now() + 24 * 3600000).toISOString()),
      ]);
      await failClear(db, "em:" + email);
      const mailed = await sendMail(env, db, { to: email, ...mails.emailChanged(org.name, email, `${orgUrl(org.code)}#reset=${tok}`), kind: "email_changed", orgId: O });
      await sendMail(env, db, { to: u.email, ...mails.emailChangedOld(org.name, email), kind: "email_changed", orgId: O });
      await logEvent(db, "member", O, actor, `Email schimbat: ${u.email} → ${email} (link de parolă trimis)`);
      return json({ email, mailed });
    }
    case "sa_note": await run(db, "UPDATE orgs SET note = ? WHERE id = ?", str(body.note, 2000), O); return json(true);
    case "sa_adjust": { // credits added (bonus) or taken (correction) by hand, with a reason; not counted as money received
      const amount = Number.isFinite(Number(body.amount)) ? Math.round(Number(body.amount) * 100) / 100 : 0, reason = str(body.reason, 300).trim();
      if (!amount || Math.abs(amount) > 100000) return json({ message: "bad_amount" }, 400);
      if (!reason) return json({ message: "need_reason" }, 400);
      const method = amount > 0 ? "bonus" : "corectie";
      let r: any;
      if (amount > 0) r = await topUp(db, org, amount, { note: reason, method });
      else {
        const b = await one(db, "UPDATE orgs SET balance = ROUND(balance + ?, 2) WHERE id = ? RETURNING balance", amount, O);
        await run(db, "INSERT INTO payments(id, org_id, amount, months, paid_until, note, method, invoice_id, balance_after) VALUES (?,?,?,0,'',?,?,'',?)", uuid(), O, amount, reason, method, b.balance);
        const now = await chargeOrg(db, await one(db, "SELECT * FROM orgs WHERE id = ?", O)), bb = await billingOf(db, now);
        r = { balance: bb.balance, active_until: bb.active_until, days_left: bb.days_left };
      }
      await logEvent(db, "payment", O, actor, `${amount > 0 ? "Bonus" : "Corecție"} ${amount} credite (${reason}) → sold ${r.balance}`);
      return json(r);
    }
    case "sa_member_role": {
      const uid = str(body.user_id, 40), role = str(body.role, 20);
      if (!ROLES_SA.includes(role)) return json({ message: "bad_role" }, 400);
      const m = await one(db, "SELECT m.role, u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.user_id = ?", O, uid);
      if (!m) return json({ message: "not_found" }, 404);
      if (m.role === "prop") return json({ message: "is_prop" }, 409); // owners of apartments are managed from the company's app
      if (m.role === role) return json(role);
      if (m.role === "owner" && (await one(db, "SELECT COUNT(*) AS n FROM members WHERE org_id = ? AND role = 'owner'", O)).n < 2) return json({ message: "last_owner" }, 409);
      await run(db, "UPDATE members SET role = ? WHERE org_id = ? AND user_id = ?", role, O, uid);
      await logEvent(db, "member", O, actor, `Rol schimbat: ${m.email} ${m.role} → ${role}`);
      return json(role);
    }
    case "sa_member_remove": {
      const uid = str(body.user_id, 40);
      const m = await one(db, "SELECT m.role, u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.user_id = ?", O, uid);
      if (!m) return json({ message: "not_found" }, 404);
      if (m.role === "owner" && (await one(db, "SELECT COUNT(*) AS n FROM members WHERE org_id = ? AND role = 'owner'", O)).n < 2) return json({ message: "last_owner" }, 409);
      await db.batch([
        db.prepare("DELETE FROM members WHERE org_id = ? AND user_id = ?").bind(O, uid),
        db.prepare("DELETE FROM sessions WHERE org_id = ? AND user_id = ?").bind(O, uid),
      ]);
      await logEvent(db, "member", O, actor, `Scos din companie: ${m.email} (${m.role})`);
      return json(true);
    }
    case "sa_org_export": { // everything the company has, as one JSON file (no PIN hashes, no sessions)
      const out: any = { exported_at: nowIso(), org, members: await all(db, "SELECT u.name, u.email, m.role, m.created_at FROM members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ?", O) };
      for (const t of ORG_TABLES) if (!NO_EXPORT.includes(t)) {
        const rows = await all(db, `SELECT * FROM ${t} WHERE org_id = ?`, O).catch(() => []);
        out[t] = t === "staff" ? rows.map(({ pin_hash, ...r }: any) => r) : rows;
      }
      await logEvent(db, "export", O, actor, "Datele companiei exportate (JSON)");
      return json(out);
    }
    case "sa_org_delete": { // for good: every row of the company; people left without any company are removed too
      if (str(body.confirm, 60) !== org.code) return json({ message: "bad_confirm" }, 400);
      const users = await all(db, "SELECT user_id FROM members WHERE org_id = ?", O);
      await db.batch([...ORG_TABLES.map((t) => db.prepare(`DELETE FROM ${t} WHERE org_id = ?`).bind(O)), db.prepare("UPDATE leads SET org_id = '' WHERE org_id = ?").bind(O), db.prepare("DELETE FROM orgs WHERE id = ?").bind(O)]);
      let gone = 0;
      for (const { user_id } of users) {
        const u = await one(db, "SELECT email FROM users WHERE id = ?", user_id);
        if (!u || isSuperEmail(env, u.email) || await one(db, "SELECT 1 AS x FROM members WHERE user_id = ?", user_id)) continue;
        await db.batch([db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user_id), db.prepare("DELETE FROM pw_resets WHERE user_id = ?").bind(user_id), db.prepare("DELETE FROM users WHERE id = ?").bind(user_id)]);
        gone++;
      }
      await logEvent(db, "delete", "", actor, `Companie ștearsă definitiv: ${org.name} (${org.code}.espace.md), ${users.length} membri, ${gone} conturi fără altă companie șterse`);
      return json({ deleted: true, users_removed: gone });
    }
    case "sa_price": { // the company's own rate: credits per unit per day (0 = the general rate)
      const r = Math.max(0, Math.min(1000, Math.round(num(body.rate ?? body.price) * 100) / 100));
      await run(db, "UPDATE orgs SET apt_rate = ? WHERE id = ?", r, O);
      await logEvent(db, "price", O, actor, r ? `Tarif propriu: ${r} credite / unitate / zi` : "Tarif general");
      return json(r);
    }
    case "sa_billing": { // the company's details for invoices
      const b: any = {}; for (const k of BILL_FIELDS) b[k] = str(body[k], 200);
      if (b.email && !isEmail(b.email)) return json({ message: "bad_email" }, 400);
      await run(db, "UPDATE orgs SET billing = ? WHERE id = ?", JSON.stringify(b), O);
      return json(b);
    }
    case "sa_support": { // open the company's app read-only, for 2 hours
      const token = await newSession(db, c.user.id, O);
      await run(db, "UPDATE sessions SET support = 1, expires_at = ? WHERE token_hash = ?", new Date(Date.now() + 2 * 3600000).toISOString(), await sha256hex(token));
      await logEvent(db, "support", O, actor, "Acces suport (doar vizualizare) deschis");
      return json({ token, slug: org.code });
    }
    case "sa_invoice_create": {
      const b = await billingOf(db, org);
      const amount = body.amount !== undefined && body.amount !== "" ? Math.round(num(body.amount) * 100) / 100 : (b.price ?? 0) * Math.max(1, Math.min(24, Math.floor(num(body.months)) || 1));
      if (!(amount > 0)) return json({ message: "bad_amount" }, 400);
      return json(await createInvoice(db, env, org, amount, { note: str(body.note, 500), send: body.send !== false, actor }));
    }
    case "sa_invoice_status": {
      const inv = await one(db, "SELECT * FROM invoices WHERE id = ? AND org_id = ?", str(body.id, 40), O);
      if (!inv) return json({ message: "not_found" }, 404);
      if (body.status === "paid" && inv.status !== "paid") {
        if (inv.status === "void") return json({ message: "bad_status" }, 409);
        const claim = await run(db, "UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'sent'", today(), inv.id);
        if (!claim.meta.changes) return json({ message: "bad_status" }, 409);
        const r = await paid(db, env, org, inv.amount, actor, { note: "Factura " + inv.number, method: str(body.method, 30) || "transfer", invoiceId: inv.id });
        await run(db, "UPDATE invoices SET payment_id = ? WHERE id = ?", r.payment_id, inv.id);
        return json(r);
      }
      if (body.status === "void" && inv.status === "sent") {
        await run(db, "UPDATE invoices SET status = 'void' WHERE id = ?", inv.id);
        await logEvent(db, "invoice", O, actor, `Factura ${inv.number} anulată`);
        return json(true);
      }
      return json({ message: "bad_status" }, 409);
    }
  }
  return json({ message: "not_found" }, 404);
}

