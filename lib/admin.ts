// espace.md — the platform owner's panel (admin.espace.md): metrics, companies, invoices, leads, activity, announcements, settings.
import {
  type Ctx, json, uuid, num, str, isDate, isEmail, all, one, run, randCode, newSession,
  TIERS, today, addDays, addMonths, activeUntil, tierFor, sha256hex, hashPassword, starterConfig,
} from "./core";
import { slugOk } from "./host";

export async function logEvent(db: D1Database, kind: string, orgId: string, actor: string, text: string) {
  await run(db, "INSERT INTO events(kind, org_id, actor, text) VALUES (?,?,?,?)", kind, orgId || "", actor || "", text.slice(0, 500)).catch(() => {});
}

export const SELLER_DEFAULT = {
  name: "", idno: "", vat_code: "", address: "", bank: "", iban: "", bic: "", email: "", phone: "",
  vat: false, vat_rate: 20, prefix: "ESP", due_days: 5, footer: "",
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
    all(db, "SELECT org_id, SUM(amount) AS total, COUNT(*) AS n, MIN(created_at) AS first FROM payments GROUP BY org_id"),
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
  return orgs.map((o) => {
    const n = apts[o.id] || 0, tier = tierFor(n), custom = Number(o.custom_price) > 0 ? Number(o.custom_price) : 0;
    const until = activeUntil(o), paying = (o.paid_until || "") >= t && o.status !== "blocked";
    const state = o.status === "blocked" ? "blocked" : paying ? "paid" : (o.trial_ends || "") >= t ? "trial" : "expired";
    let billing: any = {}; try { billing = JSON.parse(o.billing || "{}"); } catch {}
    return {
      id: o.id, name: o.name, code: o.code, status: o.status, state, note: o.note, created_at: o.created_at,
      trial_ends: o.trial_ends, paid_until: o.paid_until, active_until: until, days_left: daysBetween(t, until || t),
      apts: n, price: custom || tier.price, custom_price: custom, tier_price: tier.price,
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
  const mrr = paying.reduce((s, o) => s + (o.price || 0), 0);
  // trial → paid: companies whose 14 days are over, and how many of them ever paid
  const matured = orgs.filter((o) => (o.trial_ends || "") < t);
  const converted = matured.filter((o) => o.payments > 0).length;
  // churn: paying customers whose paid time ran out in the last 30 days
  const lapsed = orgs.filter((o) => o.payments > 0 && o.state !== "paid" && (o.active_until || "") >= d30 && (o.active_until || "") < t);
  const payments = await all(db, "SELECT * FROM payments ORDER BY created_at DESC");
  // MRR by month from payments: each payment spreads amount/months over the months it covers
  const months = lastMonths(12);
  const mrrSeries = months.map((m) => {
    const mid = m + "-15";
    let s = 0;
    for (const p of payments) { const from = addMonths(p.paid_until, -Math.max(1, p.months || 1)); if (from <= mid && mid < p.paid_until) s += (p.amount || 0) / Math.max(1, p.months || 1); }
    return Math.round(s);
  });
  const revenue = months.map((m) => Math.round(payments.filter((p) => monthKey(p.created_at) === m).reduce((s, p) => s + (p.amount || 0), 0)));
  // sign-ups per week, last 12 weeks
  const weeks: string[] = []; for (let i = 11; i >= 0; i--) weeks.push(addDays(t, -7 * i - 6));
  const signups = weeks.map((w) => orgs.filter((o) => o.created_at.slice(0, 10) >= w && o.created_at.slice(0, 10) <= addDays(w, 6)).length);
  const leads = await all(db, "SELECT * FROM leads ORDER BY created_at DESC");
  const invoices = await all(db, "SELECT i.*, o.name AS org_name FROM invoices i LEFT JOIN orgs o ON o.id = i.org_id WHERE i.status = 'sent' ORDER BY i.due_at");
  // what needs the owner today
  const attention: any[] = [];
  for (const o of orgs) {
    if (o.state === "trial" && o.days_left <= 3) attention.push({ kind: "trial_end", org_id: o.id, name: o.name, days: o.days_left, price: o.price });
    if (o.state === "paid" && o.days_left <= 7) attention.push({ kind: "renewal", org_id: o.id, name: o.name, days: o.days_left, price: o.price });
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
      apts_total: orgs.reduce((s, o) => s + o.apts, 0), unpaid_invoices: invoices.reduce((s, i) => s + (i.amount || 0), 0),
      new_leads: leads.filter((l) => l.status === "new").length, signups_30d: orgs.filter((o) => o.created_at.slice(0, 10) >= d30).length,
      this_month: thisMonth, last_month: lastMonth,
    },
    series: { months, mrr: mrrSeries, revenue, weeks, signups },
    tiers: TIERS.map(([lo, hi, p]) => ({ lo, hi, price: p, orgs: paying.filter((o) => o.apts >= lo && o.apts <= hi && !o.custom_price).length })),
    attention, events: await all(db, "SELECT e.*, o.name AS org_name FROM events e LEFT JOIN orgs o ON o.id = e.org_id ORDER BY e.id DESC LIMIT 25"),
  };
}

async function nextInvoiceNumber(db: D1Database, prefix: string) {
  const y = today().slice(0, 4), k = "inv_seq_" + y;
  await run(db, "INSERT INTO sys_state(k, v) VALUES (?, '0') ON CONFLICT (k) DO NOTHING", k);
  const r = await one(db, "UPDATE sys_state SET v = CAST(v AS INTEGER) + 1 WHERE k = ? RETURNING v", k);
  return `${prefix || "ESP"}-${y}-${String(r.v).padStart(4, "0")}`;
}
// a payment extends paid time by N months from the later of today and the current end
async function recordPayment(db: D1Database, org: any, months: number, amount: number, note: string, method: string, invoiceId = "") {
  const base = [today(), org.paid_until || "", org.trial_ends || ""].sort().pop()!;
  const until = addMonths(base, months), pid = uuid();
  await db.batch([
    db.prepare("UPDATE orgs SET paid_until = ?, status = 'active' WHERE id = ?").bind(until, org.id),
    db.prepare("INSERT INTO payments(id, org_id, amount, months, paid_until, note, method, invoice_id) VALUES (?,?,?,?,?,?,?,?)").bind(pid, org.id, amount, months, until, note, method, invoiceId),
  ]);
  return { payment_id: pid, paid_until: until };
}

const LEAD_STATES = ["new", "contacted", "demo", "won", "lost"];
const BILL_FIELDS = ["legal_name", "idno", "vat_code", "address", "email", "phone", "contact"];

export async function handleAdmin(fn: string, body: any, c: Ctx, db: D1Database): Promise<Response> {
  const actor = c.user.email;
  switch (fn) {
    case "sa_overview": return json(await overview(db));
    case "sa_orgs": return json({ orgs: await orgRows(db), tiers: TIERS });
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
        v[k] = typeof d === "boolean" ? body[k] === true : typeof d === "number" ? Math.max(0, Math.min(365, num(body[k]))) : str(body[k], 300);
      }
      v.prefix = String(v.prefix || "ESP").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "ESP";
      await run(db, "INSERT INTO sys_state(k, v) VALUES ('seller', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v", JSON.stringify(v));
      return json(v);
    }
    case "sa_org_create": { // open a company for a client (after a call): owner gets a starting password
      const name = str(body.org_name, 80), slug = str(body.slug, 40).toLowerCase(), email = str(body.email, 120).toLowerCase(), owner = str(body.owner_name, 60);
      const pw = typeof body.password === "string" ? body.password : "";
      if (!name || !owner) return json({ message: "need_names" }, 400);
      if (!slugOk(slug)) return json({ message: "bad_slug" }, 400);
      if (await one(db, "SELECT 1 AS x FROM orgs WHERE code = ?", slug)) return json({ message: "slug_taken" }, 409);
      if (!isEmail(email)) return json({ message: "bad_email" }, 400);
      let u = await one(db, "SELECT id FROM users WHERE email = ?", email);
      const stmts: D1PreparedStatement[] = [];
      if (!u) {
        if (pw.length < 8 || pw.length > 128) return json({ message: "pw_too_short" }, 400);
        u = { id: uuid() };
        stmts.push(db.prepare("INSERT INTO users(id, email, name, pw_hash) VALUES (?,?,?,?)").bind(u.id, email, owner, await hashPassword(pw)));
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
      return json({ id: oid, slug });
    }
    case "sa_anns": return json(await all(db, "SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50"));
    case "sa_ann_save": {
      const text = str(body.text, 400); if (!text) return json({ message: "need_text" }, 400);
      const id = str(body.id, 40) || uuid(), level = body.level === "warn" ? "warn" : "info", ends = isDate(body.ends) ? body.ends : "";
      await run(db, `INSERT INTO announcements(id, text, level, ends, active) VALUES (?,?,?,?,?)
        ON CONFLICT (id) DO UPDATE SET text = excluded.text, level = excluded.level, ends = excluded.ends, active = excluded.active`, id, text, level, ends, body.active === false ? 0 : 1);
      return json(id);
    }
    case "sa_ann_delete": await run(db, "DELETE FROM announcements WHERE id = ?", str(body.id, 40)); return json(true);
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
      const usage = await one(db, `SELECT (SELECT COUNT(*) FROM bookings WHERE org_id = ?) AS bookings, (SELECT COUNT(*) FROM tasks WHERE org_id = ? AND kind IN ('clean','general') AND status = 'done') AS cleanings,
        (SELECT COUNT(*) FROM handovers WHERE org_id = ?) AS shifts, (SELECT COUNT(*) FROM expenses WHERE org_id = ?) AS expenses, (SELECT COUNT(*) FROM guides WHERE org_id = ?) AS guides`, O, O, O, O, O);
      return json({ org: row, members, payments, invoices, events, leads, usage });
    }
    case "sa_pay": {
      const months = Math.max(1, Math.min(24, Math.floor(num(body.months)) || 1)), amount = num(body.amount), note = str(body.note, 300);
      const r = await recordPayment(db, org, months, amount, note, str(body.method, 30));
      await logEvent(db, "payment", O, actor, `Plată ${amount} lei pentru ${months} luni → activ până ${r.paid_until}`);
      return json(r);
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
    case "sa_note": await run(db, "UPDATE orgs SET note = ? WHERE id = ?", str(body.note, 2000), O); return json(true);
    case "sa_price": { // individual monthly price (0 = by the steps); needed for 71+ apartments
      const p = num(body.price);
      await run(db, "UPDATE orgs SET custom_price = ? WHERE id = ?", p, O);
      await logEvent(db, "price", O, actor, p ? `Preț individual: ${p} lei/lună` : "Preț după trepte");
      return json(p);
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
      const s = await getSettings(db);
      const row = (await orgRows(db)).find((o) => o.id === O)!;
      const months = Math.max(1, Math.min(24, Math.floor(num(body.months)) || 1));
      const price = row.price ?? 0;
      const amount = body.amount !== undefined && body.amount !== "" ? num(body.amount) : price * months;
      const from = isDate(body.period_from) ? body.period_from : ((row.active_until || "") >= today() ? row.active_until : today());
      const to = addMonths(from, months), issued = today(), due = addDays(issued, Math.max(0, Number(s.due_days) || 5));
      const buyer = { name: org.name, ...row.billing };
      const id = uuid(), number = await nextInvoiceNumber(db, s.prefix), token = randCode(16);
      await run(db, `INSERT INTO invoices(id, org_id, number, token, issued_at, due_at, period_from, period_to, months, apts, amount, status, buyer, seller, note)
        VALUES (?,?,?,?,?,?,?,?,?,?,?, 'sent', ?,?,?)`, id, O, number, token, issued, due, from, to, months, row.apts, amount, JSON.stringify(buyer), JSON.stringify(s), str(body.note, 500));
      await logEvent(db, "invoice", O, actor, `Factura ${number}: ${amount} lei, ${months} luni`);
      return json({ id, number, token });
    }
    case "sa_invoice_status": {
      const inv = await one(db, "SELECT * FROM invoices WHERE id = ? AND org_id = ?", str(body.id, 40), O);
      if (!inv) return json({ message: "not_found" }, 404);
      if (body.status === "paid" && inv.status !== "paid") {
        const r = await recordPayment(db, org, inv.months, inv.amount, "Factura " + inv.number, str(body.method, 30) || "transfer", inv.id);
        await run(db, "UPDATE invoices SET status = 'paid', paid_at = ?, payment_id = ? WHERE id = ?", today(), r.payment_id, inv.id);
        await logEvent(db, "payment", O, actor, `Factura ${inv.number} achitată: ${inv.amount} lei → activ până ${r.paid_until}`);
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

