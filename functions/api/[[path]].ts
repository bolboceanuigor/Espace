// espace.md API — Cloudflare Pages Functions + D1.
// Ported from Rentwill and made multi-tenant: every query is scoped to the caller's company (org_id),
// ids sent by the browser are only ever matched together with that org_id.
import { buildMonthWorkbook, monthTitle, buildHandoverWorkbook } from "../../lib/excel";
import { newVapid, sendPush, type Vapid } from "../../lib/push";
import {
  type Env, type Ctx, json, sleep, nowIso, uuid, num, str, isDate, isUuid, snum, isEmail, all, one, run,
  starterConfig, hashPin, pinMatches, hashPassword, passwordMatches, throttled, failHit, failClear, newSession, bearer, loadSession,
  ROLES, roleAllows, READ_FNS, TRIAL_DAYS, TIERS, today, addMonths, isExpired, billingOf, chargeOrg, topUp, stayPrice, minNights, randCode, randHex, sameStr, sha256hex,
} from "../../lib/core";
import { hostOf, siteOf, slugOk, isSlug } from "../../lib/host";
import { handleAdmin, logEvent, activeAnnouncement, getSettings, createInvoice } from "../../lib/admin";
import { sendMail, mails, dailyMail, orgEmail } from "../../lib/mail";
import { botName, linkCode, webhookSecret, handleUpdate, tgNotify } from "../../lib/telegram";
import { syncFeed, syncDue, feedUrlOk, sourceOf, newIcalKey } from "../../lib/ical";
import { contractTexts, fill, DEFAULT_TPL } from "../../lib/contract";


// A one-time link to set a password. Opening it proves the email belongs to the person, so it is the only way
// to get a password: at sign-up, when added to a team, when the email changes, and for "forgot password".
// The link opens the company's own address (the admin's for the platform owner).
function orgUrlOf(slug: string, request: Request) {
  const h = hostOf(request);
  return h.endsWith("espace.md") || siteOf(h).kind !== "dev" ? `https://${slug}.espace.md/` : `${new URL(request.url).origin}/app?c=${encodeURIComponent(slug)}`;
}
async function passwordLink(db: D1Database, request: Request, userId: string, hours: number, opts: { slug?: string; admin?: boolean } = {}) {
  const tok = randHex(32);
  await run(db, "INSERT INTO pw_resets(token_hash, user_id, expires_at) VALUES (?,?,?)", await sha256hex(tok), userId, new Date(Date.now() + hours * 3600000).toISOString());
  const h = hostOf(request), site = siteOf(h), prod = h.endsWith("espace.md"), origin = new URL(request.url).origin;
  if (opts.admin) return (prod ? "https://admin.espace.md/" : origin + "/admin") + "#reset=" + tok;
  let slug = opts.slug || "";
  if (!slug) { const m = await one(db, "SELECT o.code FROM members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY m.created_at LIMIT 1", userId); slug = m?.code || ""; }
  if (!slug) return (prod ? "https://espace.md/" : origin + "/") + "#reset=" + tok;
  return (prod || site.kind !== "dev" ? `https://${slug}.espace.md/` : `${origin}/app?c=${encodeURIComponent(slug)}`) + "#reset=" + tok;
}

const MONEY_KEYS = ["schet", "eur", "usd", "mdl"];
const TAGS = ["booking", "airbnb", "closed"];

const xlsx = (buf: ArrayBuffer | Uint8Array, name: string) => new Response(buf as any, { headers: {
  "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`, "cache-control": "no-store" } });

function guideToken() { return randCode(10); }
async function getConfig(db: D1Database, O: string) { const c = await one(db, "SELECT data FROM app_config WHERE org_id = ?", O); return c ? JSON.parse(c.data) : null; }

async function loadAll(db: D1Database, O: string) {
  const [config, bookings, expenses, handovers, staff, tasks, checks] = await Promise.all([
    getConfig(db, O),
    all(db, "SELECT * FROM bookings WHERE org_id = ? ORDER BY date, created_at", O),
    all(db, "SELECT * FROM expenses WHERE org_id = ? ORDER BY date, created_at", O),
    all(db, "SELECT * FROM handovers WHERE org_id = ? ORDER BY date_from DESC, created_at DESC", O),
    all(db, "SELECT id, name, salary, extra_rate, cycle_start, on_days, off_days, active, pin_hash != '' AS has_pin, created_at FROM staff WHERE org_id = ? ORDER BY created_at", O),
    all(db, "SELECT id, kind, date, apt, staff_id, status, note, cost, booking_id, reported_by, time, sent, shift_person, done_by, done_shift, result, done_at, created_at, updated_at, photo != '' AS has_photo FROM tasks WHERE org_id = ? ORDER BY date, created_at", O),
    all(db, "SELECT apt, item, MAX(date) AS last FROM checks WHERE org_id = ? GROUP BY apt, item", O),
  ]);
  const reminders = await all(db, "SELECT id, at, text, target, sent FROM reminders WHERE org_id = ? AND (sent = 0 OR at >= ?) ORDER BY at", O, addDays(nowIso().slice(0, 10), -3));
  for (const r of reminders) r.sent = !!r.sent;
  const todos = await all(db, "SELECT * FROM todos WHERE org_id = ? AND (done = 0 OR done_at >= ?) ORDER BY created_at", O, addDays(nowIso().slice(0, 10), -7) + "T");
  for (const t of todos) { t.done = !!t.done; delete t.notified; delete t.org_id; }
  for (const st of staff) { st.has_pin = !!st.has_pin; st.active = !!st.active; }
  for (const t of tasks) { t.has_photo = !!t.has_photo; t.sent = !!t.sent; }
  for (const b of bookings) { b.verified = !!b.verified; delete b.shift_adopted; delete b.org_id; }
  for (const e of expenses) { e.yearly = !!e.yearly; delete e.org_id; }
  for (const h of handovers) { h.rows = JSON.parse(h.rows || "[]"); h.cols = JSON.parse(h.cols || "[]"); h.closed = !!h.closed; h.verified = !!h.verified; delete h.org_id; }
  const notifs = await all(db, "SELECT id, at, title, body FROM notifs WHERE org_id = ? AND target = 'manager' ORDER BY id DESC LIMIT 50", O);
  const vinfo = await all(db, "SELECT kind, ref_id, state, who, at, note, snap FROM verify_info WHERE org_id = ?", O);
  const closedMonths = await all(db, "SELECT ym, who, at FROM month_close WHERE org_id = ? ORDER BY ym", O);
  return { config, bookings, expenses, handovers, staff, tasks, checks, reminders, todos, notifs, vinfo, closedMonths };
}

// Shift rows with a check-in date become calendar bookings (linked by shift_id); rows removed from the shift remove their booking.
async function syncShift(db: D1Database, O: string, hid: string, person: string, rows: any[]) {
  const apts: string[] = ((await getConfig(db, O)) || {}).apts || [];
  const keep = new Set<string>();
  for (const r of rows) {
    if (!r.bid || !r.d || !apts.includes(r.apt)) continue;
    const vals = [r.abnb || 0, r.schet, r.eur, r.usd, r.mdl, ...Object.values(r.oth || {})].map((x: any) => Number(x) || 0);
    if (vals.some((x) => x < 0) && !vals.some((x) => x > 0)) continue; // a deduction, not a stay
    const util = Number(r.util) || 0, ucur = r.ucur || "MDL";
    const mdl = Math.max(0, r.schet + r.mdl - (ucur === "MDL" ? util : 0)), eur = Math.max(0, r.eur + (Number(r.abnb) || 0) - (ucur === "EUR" ? util : 0)), usd = Math.max(0, r.usd - (ucur === "USD" ? util : 0));
    const oc = Object.keys(r.oth || {}).find((k) => r.oth[k] > 0) || "";
    const oth = oc ? r.oth[oc] : 0;
    const air = r.src === "Airbnb" && (r.eur > 0 || Number(r.abnb) > 0);
    const cashIn = r.schet > 0 || r.mdl > 0 || r.usd > 0 || (r.eur > 0 && r.src !== "Airbnb");
    const pay = (air || Number(r.abnb) > 0) && !cashIn ? "Airbnb" : r.schet > 0 && r.mdl > 0 ? "Счёт+Кэш" : r.schet > 0 ? "Счёт" : (mdl || eur || usd || oth) ? "Кэш" : (r.src === "Airbnb" ? "Airbnb" : "");
    const res = await one(db, `INSERT INTO bookings(id,org_id,date,apt,guest,nights,mdl,eur,usd,oth,oth_cur,pay,who,note,source,shift_id,util,util_cur)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT (id) DO UPDATE SET date=excluded.date, apt=excluded.apt, guest=excluded.guest, nights=excluded.nights, mdl=excluded.mdl, eur=excluded.eur, usd=excluded.usd, oth=excluded.oth, oth_cur=excluded.oth_cur, pay=excluded.pay, who=excluded.who, note=excluded.note, source=excluded.source, util=excluded.util, util_cur=excluded.util_cur,
        verified=(bookings.verified AND bookings.mdl=excluded.mdl AND bookings.eur=excluded.eur AND bookings.usd=excluded.usd AND bookings.oth IS excluded.oth AND bookings.util=excluded.util AND bookings.pay=excluded.pay),
        shift_adopted=(bookings.shift_adopted OR bookings.shift_id IS NULL), shift_id=excluded.shift_id, updated_at=?
      WHERE bookings.org_id = excluded.org_id AND (bookings.shift_id = excluded.shift_id OR (? AND (bookings.shift_id IS NULL OR (bookings.mdl = 0 AND bookings.eur = 0 AND bookings.usd = 0 AND IFNULL(bookings.oth,0) = 0 AND bookings.pay != 'Airbnb')))) RETURNING id`,
      r.bid, O, r.d, r.apt, r.guest || "", r.dop ? 0 : (r.n || 1), mdl, eur, usd, oth, oc, pay, person, r.dop ? (r.note || "доплата к авансу") : (r.note || ""), r.src || "", hid, util, ucur, nowIso(), r.adopt ? 1 : 0);
    if (res) keep.add(r.bid);
  }
  // a booking that existed in the calendar before the shift took it over is only unlinked, never deleted
  for (const b of await all(db, "SELECT id, shift_adopted FROM bookings WHERE org_id = ? AND shift_id = ?", O, hid)) if (!keep.has(b.id)) {
    if (b.shift_adopted) await run(db, "UPDATE bookings SET shift_id = NULL, shift_adopted = 0 WHERE org_id = ? AND id = ?", O, b.id);
    else await run(db, "DELETE FROM bookings WHERE org_id = ? AND id = ?", O, b.id);
  }
  // money spent from the till (rows where everything is negative) → the expenses list
  const keepE = new Set<string>();
  const td = nowIso().slice(0, 10);
  for (const r of rows) {
    if (!r.eid) continue;
    const vals = [r.schet, r.eur, r.usd, r.mdl, ...Object.values(r.oth || {})].map((x: any) => Number(x) || 0);
    if (!(vals.some((x) => x < 0) && !vals.some((x) => x > 0))) continue;
    const oc = Object.keys(r.oth || {}).find((k) => r.oth[k] < 0) || "";
    const apt = apts.includes(r.apt) ? r.apt : "";
    const note = [apts.includes(r.apt) ? "" : r.apt, r.note, "из смены"].filter(Boolean).join(" · ");
    const date = r.ed || r.d || td, cat = r.cat || (/убор/i.test(r.apt + " " + r.note) ? "Уборка" : "Прочее");
    const res = await one(db, `INSERT INTO expenses(id,org_id,date,apt,category,mdl,eur,usd,oth,oth_cur,who,note,shift_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT (id) DO UPDATE SET date=excluded.date, apt=excluded.apt, category=excluded.category, mdl=excluded.mdl, eur=excluded.eur, usd=excluded.usd, oth=excluded.oth, oth_cur=excluded.oth_cur, who=excluded.who, note=excluded.note, updated_at=?
      WHERE expenses.org_id = excluded.org_id AND expenses.shift_id = excluded.shift_id RETURNING id`,
      r.eid, O, date, apt, cat, -Math.min(0, r.schet + r.mdl), -Math.min(0, r.eur), -Math.min(0, r.usd), oc ? -r.oth[oc] : 0, oc, person, note, hid, nowIso());
    if (res) keepE.add(r.eid);
  }
  for (const e of await all(db, "SELECT id FROM expenses WHERE org_id = ? AND shift_id = ?", O, hid)) if (!keepE.has(e.id)) await run(db, "DELETE FROM expenses WHERE org_id = ? AND id = ?", O, e.id);
}

// ---------- cleaners ----------
const dayNum = (d: string) => Math.round(Date.parse(d + "T00:00:00Z") / 86400000);
const addDays = (d: string, n: number) => new Date((dayNum(d) + n) * 86400000).toISOString().slice(0, 10);
// a manual swap for that day (config.duty[date] = staff id) wins over the schedule
function isDutyC(st: any, d: string, cfg: any, staffIds: string[]) {
  const o = cfg?.duty?.[d]; const l = (Array.isArray(o) ? o : o ? [o] : []).filter((id: string) => staffIds.includes(id));
  if (l.length) return l.includes(st.id); return onDuty(st, d);
}
function onDuty(st: any, d: string) {
  if (!st.cycle_start) return false; // helper without schedule: only when added for the day
  const len = (st.on_days || 3) + (st.off_days || 3);
  return (((dayNum(d) - dayNum(st.cycle_start)) % len) + len) % len < (st.on_days || 3);
}
const DEFAULT_CHECKLIST = [
  { id: "c1", text: "Всё работает: свет, вода, пульт, Wi-Fi", every: 0 },
  { id: "c2", text: "Свежее бельё и полотенца, мусор вынесен, холодильник пуст", every: 0 },
  { id: "c3", text: "Под кроватью и за диваном", every: 14 },
  { id: "c4", text: "Холодильник и морозилка внутри", every: 14 },
  { id: "c5", text: "Духовка и микроволновка внутри", every: 14 },
  { id: "c6", text: "Вытяжка и жир на кухне", every: 30 },
  { id: "c7", text: "Окна и подоконники", every: 30 },
  { id: "c8", text: "Слив в душе и сифон", every: 30 },
  { id: "c9", text: "Плинтусы и двери", every: 30 },
  { id: "c10", text: "Шторы — снять и постирать", every: 60 },
  { id: "c11", text: "Фильтр кондиционера", every: 60 },
  { id: "c12", text: "Матрас перевернуть, наматрасник постирать", every: 90 },
];
async function cleanerView(db: D1Database, O: string, me: any, td: string) {
  const cfg = (await getConfig(db, O)) || {};
  const checklist = (Array.isArray(cfg.checklist) && cfg.checklist.length ? cfg.checklist : DEFAULT_CHECKLIST);
  const staff = await all(db, "SELECT * FROM staff WHERE org_id = ? AND active = 1 ORDER BY created_at", O);
  const staffIdsAll = staff.map((x: any) => x.id);
  const from = addDays(td, -1), to = addDays(td, 6);
  const bks = await all(db, "SELECT id, apt, date, nights FROM bookings WHERE org_id = ? AND nights > 0 AND tag NOT IN ('closed','req') AND date >= ? AND date <= ?", O, addDays(from, -400), to);
  const tasks = await all(db, "SELECT id, kind, date, apt, staff_id, status, note, booking_id, reported_by, time, sent FROM tasks WHERE org_id = ? AND ((date >= ? AND date <= ?) OR (kind = 'repair' AND status != 'done'))", O, from, to);
  const lastRows = await all(db, "SELECT apt, item, MAX(date) AS last FROM checks WHERE org_id = ? GROUP BY apt, item", O);
  const last: Record<string, string> = {}; for (const r of lastRows) last[r.apt + "|" + r.item] = r.last;
  const listFor = (apt: string, d: string) => {
    const always = checklist.filter((c: any) => !c.every).map((c: any) => ({ id: c.id, text: c.text }));
    const due = checklist.filter((c: any) => c.every > 0).map((c: any) => {
      const l = last[apt + "|" + c.id]; const age = l ? dayNum(d) - dayNum(l) : 9999;
      return { id: c.id, text: c.text, age, over: age - c.every, last: l || null };
    }).filter((c: any) => c.over >= 0).sort((a: any, b: any) => b.over - a.over).slice(0, 3);
    return [...always, ...due];
  };
  // deep-clean rotation: N items a day for her, most overdue for their frequency, max 2 per apartment
  const deepN = Number(cfg.deepPerDay) || 3;
  const jit = (k: string) => { let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % 1000) / 10000; };
  const deepPlan = (apts: string[], d: string) => {
    const cand: any[] = [];
    for (const a of new Set(apts)) for (const c of checklist) if (c.every > 0) {
      const l = last[a + "|" + c.id]; const age = l ? dayNum(d) - dayNum(l) : null; const ratio = (age == null ? 3 : age / c.every) + jit(a + c.id + d);
      if (ratio >= 0.6) cand.push({ a, id: c.id, text: c.text, age: age ?? 9999, last: l || null, ratio });
    }
    cand.sort((x, y) => y.ratio - x.ratio || y.age - x.age);
    const out: Record<string, any[]> = {}, per: Record<string, number> = {}; let k = 0;
    for (const x of cand) { if (k >= deepN) break; if ((per[x.a] || 0) >= 2) continue; (out[x.a] ||= []).push({ id: x.id, text: x.text, age: x.age, last: x.last }); per[x.a] = (per[x.a] || 0) + 1; k++; }
    return out;
  };
  const always = checklist.filter((c: any) => !c.every).map((c: any) => ({ id: c.id, text: c.text }));
  const days: any[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const items: any[] = [];
    const plan = deepPlan(tasks.filter((t: any) => t.kind === "clean" && t.date === d && t.sent && t.status !== "skip" && t.staff_id === me.id).map((t: any) => t.apt), d);
    // she sees only the lists the manager has sent (confirmed)
    for (const t of tasks) {
      if ((t.kind !== "clean" && t.kind !== "general") || t.date !== d || !t.sent || t.status === "skip" || t.staff_id !== me.id) continue;
      const full = t.kind === "general";
      items.push({ kind: t.kind, apt: t.apt, task_id: t.id, booking_id: t.booking_id || null, time: t.time || "", status: t.status, note: t.note,
        checkin_today: bks.some((x: any) => x.apt === t.apt && x.date === d),
        checklist: full ? listFor(t.apt, d).concat(checklist.filter((c: any) => c.every > 0).map((c: any) => ({ id: c.id, text: c.text }))).filter((c: any, i: number, a: any[]) => a.findIndex((x: any) => x.id === c.id) === i) : [...always, ...(plan[t.apt] || [])] });
    }
    items.sort((a, b) => (a.time || "99").localeCompare(b.time || "99") || (cfg.apts || []).indexOf(a.apt) - (cfg.apts || []).indexOf(b.apt));
    days.push({ date: d, on_duty: isDutyC(me, d, cfg, staffIdsAll), items });
  }
  const repairs = tasks.filter((t: any) => t.kind === "repair" && t.status !== "done").map((t: any) => ({ id: t.id, apt: t.apt, note: t.note, date: t.date, reported_by: t.reported_by }));
  const addr: Record<string, string> = {}; for (const a of cfg.apts || []) if (cfg.addr && cfg.addr[a]) addr[a] = cfg.addr[a];
  // beds per unit, so the cleaner knows how much linen to bring (the app words it in her language)
  const beds: Record<string, any> = {};
  for (const a of cfg.apts || []) { const u = (cfg.units || {})[a]; if (u && u.beds && Object.keys(u.beds).length) beds[a] = { beds: u.beds, guests: +u.guests || 0 }; }
  const notifs = await all(db, "SELECT id, at, title, body FROM notifs WHERE org_id = ? AND target IN ('staff', ?) ORDER BY id DESC LIMIT 30", O, "staff:" + me.id);
  return { me: { id: me.id, name: me.name }, apts: cfg.apts || [], addr, beds, days, repairs, notifs };
}

// a paid repair leaves money traces: an expense (id = task id) and, if paid from the till,
// a row in the shift (eid = task id). Removing or reopening the repair removes them too.
async function repairUnlink(db: D1Database, O: string, t: any) {
  if (!t || t.kind !== "repair") return;
  let gone = 0;
  for (const h of await all(db, "SELECT id, person, rows FROM handovers WHERE org_id = ? AND rows LIKE ?", O, "%" + t.id + "%")) {
    let rows: any[] = [];
    try { rows = JSON.parse(h.rows || "[]"); } catch { continue; }
    const left = rows.filter((r) => r?.eid !== t.id);
    if (left.length !== rows.length) { await run(db, "UPDATE handovers SET rows = ?, updated_at = ? WHERE org_id = ? AND id = ?", JSON.stringify(left), nowIso(), O, h.id); gone++; }
  }
  const r = await one(db, "DELETE FROM expenses WHERE org_id = ? AND id = ? RETURNING id", O, t.id);
  if (r) gone++;
  if (!gone && Number(t.cost) > 0)
    await run(db, "DELETE FROM expenses WHERE id = (SELECT id FROM expenses WHERE org_id = ? AND apt = ? AND category = 'Ремонт' AND mdl = ? AND (shift_id IS NULL OR shift_id = '') AND note LIKE ? ORDER BY created_at DESC LIMIT 1)",
      O, t.apt, Number(t.cost), String(t.note || "").replace(/[%_]/g, "") + "%");
}
// a month that was closed after checking can't be changed until it's reopened
async function monthClosed(db: D1Database, O: string, ...dates: (string | null | undefined)[]) {
  for (const d of dates) { if (!d || !isDate(d)) continue; const r = await one(db, "SELECT ym FROM month_close WHERE org_id = ? AND ym = ?", O, d.slice(0, 7)); if (r) return true; }
  return false;
}
const CLOSED = () => json({ message: "month_closed" }, 409);
async function shiftPerson(db: D1Database, O: string) {
  const h = await one(db, "SELECT person FROM handovers WHERE org_id = ? ORDER BY closed ASC, created_at DESC LIMIT 1", O);
  return h?.person || "";
}

// ---------- notifications ----------
const WD_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const dmy = (d: string) => d.slice(8, 10) + "." + d.slice(5, 7);
const wdDm = (d: string) => WD_RU[new Date(d + "T00:00:00Z").getUTCDay()] + " " + dmy(d);
function localNow() {
  const p: any = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Chisinau", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}
// one VAPID key pair for the whole platform
async function getVapid(db: D1Database): Promise<Vapid> {
  const r = await one(db, "SELECT v FROM sys_state WHERE k = 'vapid'");
  if (r) return JSON.parse(r.v);
  await run(db, "INSERT OR IGNORE INTO sys_state(k, v) VALUES ('vapid', ?)", JSON.stringify(await newVapid()));
  return JSON.parse((await one(db, "SELECT v FROM sys_state WHERE k = 'vapid'")).v);
}
/** who: "manager" | "staff:<id>" | "staff" (all cleaners of this company) */
// env of the current request, for helpers that don't get it passed (the bindings are the same for every request)
let ENV: Env | null = null;
async function notify(db: D1Database, O: string, who: string[], msg: { title: string; body?: string; tag?: string }) {
  for (const w of who) await run(db, "INSERT INTO notifs(org_id, target, title, body) VALUES (?,?,?,?)", O, w, msg.title, msg.body || "").catch(() => {});
  if (ENV && who.includes("manager")) await tgNotify(ENV, db, O, msg).catch(() => 0); // linked Telegram chats
  const conds: string[] = [], args: string[] = [];
  for (const w of who) {
    if (w === "manager") conds.push("staff_id = ''");
    else if (w === "staff") conds.push("staff_id != ''");
    else if (w.startsWith("staff:")) { conds.push("staff_id = ?"); args.push(w.slice(6)); }
  }
  if (!conds.length) return;
  const subs = await all(db, `SELECT endpoint, p256dh, auth FROM push_subs WHERE org_id = ? AND (${conds.join(" OR ")})`, O, ...args).catch(() => []);
  if (!subs.length) return;
  const v = await getVapid(db);
  await Promise.all(subs.map(async (s: any) => {
    const st = await sendPush(s, { ...msg, url: "/" }, v);
    if (st === 404 || st === 410) await run(db, "DELETE FROM push_subs WHERE endpoint = ?", s.endpoint);
  }));
}
async function saveSub(db: D1Database, O: string, sub: any, userId: string, staffId: string) {
  const endpoint = str(sub?.endpoint, 1000), p256dh = str(sub?.keys?.p256dh, 200), auth = str(sub?.keys?.auth, 100);
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return false;
  await run(db, `INSERT INTO push_subs(endpoint, org_id, p256dh, auth, user_id, staff_id) VALUES (?,?,?,?,?,?)
    ON CONFLICT (endpoint) DO UPDATE SET org_id=excluded.org_id, p256dh=excluded.p256dh, auth=excluded.auth, user_id=excluded.user_id, staff_id=excluded.staff_id`, endpoint, O, p256dh, auth, userId, staffId);
  return true;
}
// due reminders + the 8:00 morning summary, for one company
async function runDue(db: D1Database, org: any) {
  const O = org.id;
  const { date, hm } = localNow(), now = date + "T" + hm;
  for (const r of await all(db, "SELECT * FROM reminders WHERE org_id = ? AND sent = 0 AND at <= ?", O, now)) {
    const res = await run(db, "UPDATE reminders SET sent = 1 WHERE org_id = ? AND id = ? AND sent = 0", O, r.id);
    if (!res.meta.changes) continue;
    const who = r.target === "me" ? ["manager"] : r.target === "all" ? ["manager", "staff"] : r.target === "staff" ? ["staff"] : ["staff:" + r.target];
    await notify(db, O, who, { title: "⏰ Напоминание", body: r.text, tag: "rem-" + r.id });
  }
  for (const t of await all(db, "SELECT * FROM todos WHERE org_id = ? AND done = 0 AND notified = 0 AND due_time != '' AND due_date != '' AND (due_date || 'T' || due_time) <= ?", O, now)) {
    const res = await run(db, "UPDATE todos SET notified = 1 WHERE org_id = ? AND id = ? AND notified = 0", O, t.id);
    if (res.meta.changes) await notify(db, O, ["manager"], { title: "📝 " + (t.apt ? t.apt + ": " : "") + t.text, body: "Сейчас " + t.due_time + (t.created_by ? " · записал(а) " + t.created_by : ""), tag: "todo-" + t.id });
  }
  if (hm >= "08:00" && hm < "12:00") {
    const res = await run(db, "INSERT OR IGNORE INTO app_state(org_id, k, v) VALUES (?, ?, '1')", O, "daily-" + date);
    if (!res.meta.changes) return;
    const staff = await all(db, "SELECT * FROM staff WHERE org_id = ? AND active = 1 ORDER BY created_at", O);
    const parts: string[] = [];
    for (const st of staff) {
      const view = await cleanerView(db, O, st, date);
      const day = view.days.find((d: any) => d.date === date);
      const items = day ? day.items : [];
      if (items.length) {
        parts.push(`${st.name}: ${items.length}`);
        await notify(db, O, ["staff:" + st.id], { title: `Сегодня у тебя ${items.length} ${items.length === 1 ? "уборка" : items.length < 5 ? "уборки" : "уборок"}`, body: items.map((i: any) => i.apt).join(", "), tag: "daily" });
      }
    }
    const rep = await one(db, "SELECT COUNT(*) AS n FROM tasks WHERE org_id = ? AND kind = 'repair' AND status = 'todo'", O);
    const ins = await one(db, "SELECT COUNT(*) AS n FROM bookings WHERE org_id = ? AND date = ? AND nights > 0", O, date);
    const td = await one(db, "SELECT COUNT(*) AS n FROM todos WHERE org_id = ? AND done = 0 AND due_date != '' AND due_date <= ?", O, date);
    const body = [td?.n ? `дел на сегодня: ${td.n}` : "", parts.length ? "Уборки — " + parts.join(", ") : "Уборок нет", ins?.n ? `заездов: ${ins.n}` : "", rep?.n ? `ждёт ремонта: ${rep.n}` : ""].filter(Boolean).join(" · ");
    await notify(db, O, ["manager"], { title: org.name + " · " + wdDm(date), body, tag: "daily" });
  }
}

// ---------- accounts ----------
async function slugFree(db: D1Database, slug: string) { return slugOk(slug) && !(await one(db, "SELECT 1 AS x FROM orgs WHERE code = ?", slug)); }
async function myOrgs(db: D1Database, userId: string) {
  return all(db, "SELECT o.id, o.name, o.code, m.role FROM members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY o.created_at", userId);
}
async function meOf(db: D1Database, c: Ctx) {
  const orgs = await myOrgs(db, c.user.id);
  return {
    user: { id: c.user.id, email: c.user.email, name: c.user.name }, super: c.isSuper,
    org: c.org ? { id: c.org.id, name: c.org.name, code: c.org.code } : null, role: c.role, orgs,
    billing: c.org ? await billingOf(db, c.org) : null,
    support: c.support, announcement: c.org ? await activeAnnouncement(db) : null,
  };
}


// ---------- change log ----------
const B_F = ["date", "apt", "guest", "nights", "mdl", "eur", "usd", "oth", "oth_cur", "util", "util_cur", "pay", "who", "note", "source", "phone", "pax", "price", "price_cur", "pay_status", "tag"];
const E_F = ["date", "apt", "category", "mdl", "eur", "usd", "oth", "oth_cur", "who", "note", "yearly"];
const same = (a: any, b: any) => { const n = (v: any) => (v === null || v === undefined || v === "" || v === 0 ? "" : String(v)); return n(a) === n(b); };
function diffOf(a: any, b: any, fields: string[]) { const d: Record<string, any[]> = {}; for (const f of fields) if (!same(a?.[f], b?.[f])) d[f] = [a?.[f] ?? null, b?.[f] ?? null]; return d; }
function snapOf(a: any, fields: string[]) { const d: Record<string, any> = {}; for (const f of fields) if (!same(a?.[f], null)) d[f] = a[f]; return d; }
const ddmm = (d: string) => (d ? d.slice(8, 10) + "." + d.slice(5, 7) : "");
const bLabel = (b: any) => [b.apt, ddmm(b.date), b.tag === "closed" ? "closed" : b.guest].filter(Boolean).join(" · ");
const eLabel = (e: any) => [e.category, e.apt || "", ddmm(e.date)].filter(Boolean).join(" · ");
async function audit(db: D1Database, O: string, c: { user?: any } | null, kind: string, action: string, ref: string, label: string, data: any, who?: string) {
  await run(db, "INSERT INTO audit(org_id, user_id, who, kind, action, ref, label, data) VALUES (?,?,?,?,?,?,?,?)",
    O, c?.user?.id || "", str(who || c?.user?.name || c?.user?.email || "", 80), kind, action, ref || "", str(label, 200), JSON.stringify(data || {}).slice(0, 20000)).catch(() => {});
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params, waitUntil }) => {
  if (request.method !== "POST") return json({ message: "method_not_allowed" }, 405);
  const fn = String(([] as string[]).concat((params as any).path || []).pop() || "");
  let body: any = {};
  try { body = await request.json(); } catch { return json({ message: "bad_json" }, 400); }
  const db = env.DB; ENV = env;
  // Telegram calls this with every message sent to the bot
  if (fn === "tg_webhook") {
    const sec = await webhookSecret(env);
    if (!sec || !sameStr(request.headers.get("x-telegram-bot-api-secret-token") || "", sec)) return json({ message: "forbidden" }, 403);
    await handleUpdate(env, db, body).catch(() => {});
    return json(true);
  }
  // which company this request is for: the subdomain (rentwill.espace.md), or on test hosts the x-espace-org header
  const site = siteOf(hostOf(request));
  const reqSlug = site.kind === "tenant" ? site.slug : site.kind === "dev" ? str(request.headers.get("x-espace-org"), 40).toLowerCase() : "";

  // ---------- public: the marketing site and the company login screen ----------
  if (fn === "org_public") {
    const o = isSlug(str(body.slug, 40)) ? await one(db, "SELECT name, code FROM orgs WHERE code = ?", str(body.slug, 40)) : null;
    return o ? json({ name: o.name, slug: o.code }) : json({ message: "not_found" }, 404);
  }
  // ---------- a guest's rental contract (<slug>.espace.md/contract/<token>), public by its secret link ----------
  if (fn === "pub_contract" || fn === "pub_contract_sign") {
    const tok = str(body.token, 64);
    const k = /^[a-f0-9]{32}$/.test(tok) ? await one(db, "SELECT k.*, o.code, o.name AS org_name, o.id AS oid FROM contracts k JOIN orgs o ON o.id = k.org_id WHERE k.token = ?", tok) : null;
    if (!k || (reqSlug && k.code !== reqSlug)) return json({ message: "not_found" }, 404);
    const b = await one(db, "SELECT guest, pax, email, apt, date, nights FROM bookings WHERE org_id = ? AND id = ?", k.org_id, k.booking_id);
    if (fn === "pub_contract") {
      await run(db, "UPDATE contracts SET views = views + 1 WHERE token = ?", tok);
      return json({ company: k.org_name, number: k.number, status: k.status, texts: JSON.parse(k.texts || "{}"), lang: k.lang,
        guest: { name: k.guest_name || b?.guest || "", doc: k.guest_doc, country: k.guest_country, pax: k.guest_pax || b?.pax || 0 },
        signed: k.status === "signed" ? { at: k.signed_at, text: k.signed_text, signature: k.signature } : null, gone: !b });
    }
    if (k.status === "signed") return json({ message: "already_signed" }, 409);
    if (!b) return json({ message: "not_found" }, 404);
    const name = str(body.name, 100).trim(), doc = str(body.doc, 60).trim(), country = str(body.country, 60).trim(), pax = Math.max(1, Math.min(50, Math.floor(num(body.pax)) || 1));
    const lang = ["ro", "ru", "en"].includes(body.lang) ? body.lang : "ro", sig = str(body.signature, 300000);
    if (name.length < 3 || doc.length < 4 || !country) return json({ message: "need_details" }, 400);
    if (body.agree !== true) return json({ message: "need_agree" }, 400);
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]{400,}$/.test(sig)) return json({ message: "need_signature" }, 400);
    const texts = JSON.parse(k.texts || "{}"), text = fill(texts[lang] || texts.ro || "", { oaspete: name, act: doc, cetatenie: country, persoane: String(pax) });
    const at = nowIso();
    await run(db, `UPDATE contracts SET status = 'signed', lang = ?, guest_name = ?, guest_doc = ?, guest_country = ?, guest_pax = ?, signed_text = ?, signature = ?, signed_at = ?, signed_ip = ?, signed_ua = ? WHERE token = ? AND status != 'signed'`,
      lang, name, doc, country, pax, text, sig, at, request.headers.get("cf-connecting-ip") || "", str(request.headers.get("user-agent"), 200), tok);
    await audit(db, k.org_id, null, "booking", "signed", k.booking_id, bLabel({ ...b, guest: name }), { number: k.number }, "web");
    await notify(db, k.org_id, ["manager"], { title: `Contract semnat: ${b.apt}`, body: `${name} · ${b.date} · nr. ${k.number}` });
    const url = `https://${k.code}.espace.md/contract/${tok}`, gmail = str(body.email, 200).trim() || b.email || "";
    if (isEmail(gmail)) await sendMail(env, db, { to: gmail, ...mails.contractSigned(k.org_name, { number: k.number, apt: b.apt, date: b.date, url, guest: true }), kind: "contract", orgId: k.org_id });
    const co = await orgEmail(db, k.org_id);
    if (co) await sendMail(env, db, { to: co, ...mails.contractSigned(k.org_name, { number: k.number, apt: b.apt, date: b.date, url, guest: false, name }), kind: "contract", orgId: k.org_id });
    return json({ ok: true, at });
  }
  // ---------- an owner's monthly statement (<slug>.espace.md/raport/<token>), public by its secret link ----------
  if (fn === "pub_owner_report") {
    const tok = str(body.token, 64);
    const r = /^[a-f0-9]{32}$/.test(tok) ? await one(db, "SELECT r.*, o.code, o.name AS org_name FROM owner_reports r JOIN orgs o ON o.id = r.org_id WHERE r.token = ?", tok) : null;
    if (!r || (reqSlug && r.code !== reqSlug)) return json({ message: "not_found" }, 404);
    await run(db, "UPDATE owner_reports SET views = views + 1, viewed_at = ? WHERE token = ?", nowIso(), tok);
    const paid = await one(db, "SELECT amount, method, paid_on FROM owner_payouts WHERE org_id = ? AND owner_id = ? AND ym = ?", r.org_id, r.owner_id, r.ym);
    return json({ company: r.org_name, slug: r.code, ym: r.ym, at: r.updated_at || r.created_at, data: JSON.parse(r.data), paid: paid || null });
  }
  // ---------- direct booking page (<slug>.espace.md/rezerva), public ----------
  if (fn === "pub_listing" || fn === "pub_request" || fn === "pub_photo") {
    const code = (reqSlug || str(body.slug, 40)).toLowerCase();
    const org = isSlug(code) ? await one(db, "SELECT * FROM orgs WHERE code = ?", code) : null;
    if (!org) return json({ message: "not_found" }, 404);
    const cfg = (await getConfig(db, org.id)) || {}, dir = cfg.direct || {};
    if (!dir.on || isExpired(await chargeOrg(db, org))) return json({ message: "closed", name: org.name }, 403);
    const hidden = new Set(dir.hidden || []);
    const units = (cfg.apts || []).filter((a: string) => !hidden.has(a) && +((cfg.units || {})[a]?.price) > 0);
    if (fn === "pub_photo") {
      const apt = str(body.apt, 100); if (!units.includes(apt)) return json({ message: "not_found" }, 404);
      const ph = await one(db, "SELECT data FROM apt_photos WHERE org_id = ? AND apt = ?", org.id, apt);
      return json({ data: ph?.data || "" });
    }
    const t = today(), till = addDays(t, 400);
    const taken = await all(db, "SELECT apt, date, nights FROM bookings WHERE org_id = ? AND nights > 0 AND date < ? AND date >= ?", org.id, till, addDays(t, -60));
    const busy = (apt: string, from: string, nights: number) => taken.some((b: any) => b.apt === apt && b.date < addDays(from, nights) && addDays(b.date, b.nights) > from);
    if (fn === "pub_listing") {
      const PUB = ["kind", "group", "area", "bedrooms", "baths", "floor", "beds", "guests", "price", "pcur", "cin", "cout", "amen", "rtype"];
      return json({
        name: org.name, slug: org.code, min: Math.max(1, +dir.min || 1), pricing: { weekend: +(cfg.pricing?.weekend) || 0, seasons: (cfg.pricing?.seasons || []).map((x: any) => ({ from: x.from, to: x.to, pct: +x.pct || 0, min: +x.min || 0 })) }, phone: dir.phone || "", email: dir.email || "", terms: dir.terms || "", intro: dir.intro || "",
        units: units.map((a: string) => { const u = (cfg.units || {})[a] || {}, o: any = { name: a, addr: dir.addr === false ? "" : ((cfg.addr || {})[a] || "").split(",")[0] }; for (const k of PUB) if (u[k] != null && u[k] !== "") o[k] = u[k];
          o.busy = taken.filter((b: any) => b.apt === a && addDays(b.date, b.nights) > t).map((b: any) => [b.date, b.nights]); return o; }),
      });
    }
    // pub_request: a guest asks for dates; it lands in the calendar as a request the manager confirms or declines
    const ip = request.headers.get("cf-connecting-ip") || "x", local = ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname);
    if (!local) { if (await throttled(db, "breq:" + ip)) return json({ message: "locked" }, 429); await failHit(db, "breq:" + ip); }
    const apt = str(body.apt, 100), date = isDate(body.date) ? body.date : "", nights = Math.floor(num(body.nights));
    const name = str(body.name, 80).trim(), phone = str(body.phone, 40).trim(), email = str(body.email, 120).trim().toLowerCase(), pax = Math.max(1, Math.min(50, Math.floor(num(body.guests)) || 1));
    if (!units.includes(apt)) return json({ message: "bad_unit" }, 400);
    if (!date || date < t || nights < minNights(cfg.pricing, date, +dir.min || 1) || nights > 60) return json({ message: "bad_dates" }, 400);
    if (!name || (!phone && !isEmail(email)) || (email && !isEmail(email))) return json({ message: "need_contact" }, 400);
    const u = (cfg.units || {})[apt] || {}, cap = +u.guests || 0;
    if (cap && pax > cap) return json({ message: "too_many_guests", cap }, 400);
    if (busy(apt, date, nights)) return json({ message: "taken" }, 409);
    const price = stayPrice(+u.price, date, nights, cfg.pricing), cur = ["EUR", "MDL", "USD"].includes(u.pcur) ? u.pcur : "EUR";
    const id = uuid(), now = nowIso(), msg = str(body.message, 600).trim();
    await run(db, `INSERT INTO bookings(id, org_id, date, apt, guest, nights, phone, email, pax, source, tag, note, price, price_cur, pay_status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,'Прямой','req',?,?,?, 'unpaid', ?, ?)`,
      id, org.id, date, apt, name, nights, phone, email, pax, ("Cerere online" + (msg ? ": " + msg : "")).slice(0, 1000), price, cur, now, now);
    await audit(db, org.id, null, "booking", "request", id, bLabel({ apt, date, guest: name }), { nights, pax, price, price_cur: cur }, "web");
    await notify(db, org.id, ["manager"], { title: `Cerere de rezervare: ${apt}`, body: `${name} · ${date} · ${nights} n. · ${pax} pers.${phone ? " · " + phone : ""}` });
    const owner = await orgEmail(db, org.id);
    if (owner) await sendMail(env, db, { to: owner, ...mails.requestNew(org.name, org.code, { apt, date, nights, pax, name, phone, email, msg, price, cur }), kind: "request", orgId: org.id });
    if (email) await sendMail(env, db, { to: email, ...mails.requestGot(org.name, { apt, date, nights, pax, price, cur, phone: dir.phone || "", email: dir.email || "" }), kind: "request", orgId: org.id });
    return json({ ok: true, id, price, cur });
  }
  if (fn === "site_info") { // the operator's public details for the legal pages
    const st = await getSettings(db);
    return json({ name: st.name, idno: st.idno, address: st.address, email: st.email, phone: st.phone });
  }
  if (fn === "slug_check") {
    const slug = str(body.slug, 40).toLowerCase();
    return json({ slug, ok: await slugFree(db, slug), valid: slugOk(slug) });
  }
  if (fn === "site_lead") {
    const ip = request.headers.get("cf-connecting-ip") || "x", k = "lead:" + ip;
    if (await throttled(db, k)) return json({ message: "locked" }, 429);
    const v = { name: str(body.name, 80), phone: str(body.phone, 40), email: str(body.email, 120), apts: str(body.apts, 20), message: str(body.message, 1500), lang: str(body.lang, 5) };
    if (!v.name || (!v.phone && !isEmail(v.email))) return json({ message: "need_contact" }, 400);
    await failHit(db, k); // 10 requests per 15 minutes from one address
    await run(db, "INSERT INTO leads(id, name, phone, email, apts, message, lang) VALUES (?,?,?,?,?,?,?)", uuid(), v.name, v.phone, v.email, v.apts, v.message, v.lang);
    await logEvent(db, "lead", "", v.phone || v.email, `Cerere nouă de pe site: ${v.name}${v.apts ? ", " + v.apts + " apartamente" : ""}`);
    return json(true);
  }

  // ---------- password reset: a link by email, valid 1 hour, used once ----------
  if (fn === "auth_reset_request") {
    const email = str(body.email, 120).toLowerCase(), ip = request.headers.get("cf-connecting-ip") || "x";
    if (await throttled(db, "rst:" + ip) || await throttled(db, "rste:" + email)) return json({ message: "locked" }, 429);
    await failHit(db, "rst:" + ip); await failHit(db, "rste:" + email); // at most 10 requests per 15 minutes
    const u = isEmail(email) ? await one(db, "SELECT id, pw_hash FROM users WHERE email = ?", email) : null;
    if (u) {
      // back to where it was asked: admin, this company, or else the person's first company
      const admin = site.kind === "admin" || (site.kind === "dev" && str(body.from, 10) === "admin");
      const mine = reqSlug ? await one(db, "SELECT 1 AS x FROM members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? AND o.code = ?", u.id, reqSlug) : null;
      const url = await passwordLink(db, request, u.id, u.pw_hash ? 1 : 72, { admin, slug: mine ? reqSlug : "" });
      await sendMail(env, db, { to: email, ...(u.pw_hash ? mails.reset(url) : mails.setPassword(email, url)), kind: "reset" });
    } else await sleep(300);
    return json(true); // same answer whether the email exists or not
  }
  if (fn === "auth_reset") {
    const tok = str(body.token, 80), pw = typeof body.password === "string" ? body.password : "";
    if (!/^[0-9a-f]{64}$/.test(tok)) return json({ message: "bad_token" }, 400);
    if (pw.length < 8 || pw.length > 128) return json({ message: "pw_too_short" }, 400);
    const th = await sha256hex(tok), r = await one(db, "SELECT * FROM pw_resets WHERE token_hash = ?", th);
    // reason tells the page what to say: an older email's link (used) or more than an hour (expired)
    if (!r || r.used || r.expires_at < nowIso()) { await sleep(800); return json({ message: "bad_token", reason: !r ? "unknown" : r.used ? "used" : "expired" }, 400); }
    await db.batch([
      db.prepare("UPDATE pw_resets SET used = 1 WHERE token_hash = ?").bind(th),
      db.prepare("UPDATE users SET pw_hash = ? WHERE id = ?").bind(await hashPassword(pw), r.user_id),
      db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(r.user_id),
    ]);
    const u = await one(db, "SELECT email FROM users WHERE id = ?", r.user_id);
    if (u?.email) await failClear(db, "em:" + u.email); // earlier wrong passwords no longer count
    await logEvent(db, "password", "", u?.email || "", "Parolă setată prin linkul din email");
    // signed in at once, in the company whose address the link opened (or the first one)
    const orgs = await myOrgs(db, r.user_id), want = (reqSlug && orgs.find((o: any) => o.code === reqSlug)) || orgs[0];
    if (!want || site.kind === "admin" || str(body.from, 10) === "admin") return json({ email: u?.email || "" });
    await run(db, "UPDATE users SET last_login = ? WHERE id = ?", nowIso(), r.user_id).catch(() => {});
    return json({ email: u?.email || "", token: await newSession(db, r.user_id, want.id), slug: want.code });
  }

  // ---------- platform cron: reminders and morning summaries for every active company ----------
  if (fn === "cron") {
    if (!env.CRON_KEY || !sameStr(await sha256hex(str(body.key, 200)), await sha256hex(env.CRON_KEY))) { await sleep(1000); return json({ message: "bad_key" }, 401); }
    let n = 0;
    // every company: take today's fee from the balance, then run its reminders if it is active
    for (let org of await all(db, "SELECT * FROM orgs WHERE status = 'active'")) { org = await chargeOrg(db, org).catch(() => org); if (!isExpired(org)) { await runDue(db, org).catch(() => {}); n++; } }
    const mailed = await dailyMail(env, db).catch(() => 0);
    // Airbnb / Booking.com calendars: new reservations become bookings, managers get a notification
    const feeds = await syncDue(db, (O, msg) => notify(db, O, ["manager"], msg)).catch(() => 0);
    await run(db, "DELETE FROM audit WHERE at < ?", new Date(Date.now() - 400 * 86400000).toISOString()).catch(() => {}); // the change log keeps ~13 months
    return json({ orgs: n, mailed, feeds });
  }

  // ---------- sign up / sign in ----------
  if (fn === "auth_register") {
    // no password here: the owner gets an email with a link to set it, which also proves the address is theirs
    const orgName = str(body.org_name, 80), name = str(body.name, 60), email = str(body.email, 120).trim().toLowerCase();
    if (!orgName || !name) return json({ message: "need_names" }, 400);
    if (!isEmail(email)) return json({ message: "bad_email" }, 400);
    const slug = str(body.slug, 40).toLowerCase();
    if (body.terms !== true) return json({ message: "need_terms" }, 400);
    const ip = request.headers.get("cf-connecting-ip") || "x";
    const local = ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname);
    if (!local) { // at most 10 sign-ups per 15 minutes from one address (not throttled on a local dev server)
      if (await throttled(db, "reg:" + ip)) return json({ message: "locked" }, 429);
      await failHit(db, "reg:" + ip);
    }
    const ex = await one(db, "SELECT id, pw_hash FROM users WHERE email = ?", email);
    if (ex && !ex.pw_hash) { // signed up before but never opened the email: send it again for the company already made
      const url = await passwordLink(db, request, ex.id, 72);
      const o = await one(db, "SELECT o.name, o.code FROM members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY m.created_at LIMIT 1", ex.id);
      await sendMail(env, db, { to: email, ...mails.welcome(name, o?.name || orgName, o?.code || slug, url), kind: "welcome" });
      return json({ sent: true, email, slug: o?.code || slug, again: true });
    }
    if (ex) { await sleep(500); return json({ message: "email_taken" }, 409); }
    if (!slugOk(slug)) return json({ message: "bad_slug" }, 400);
    if (!(await slugFree(db, slug))) return json({ message: "slug_taken" }, 409);
    const uid = uuid(), oid = uuid();
    await db.batch([
      db.prepare("INSERT INTO users(id, email, name, pw_hash, terms_at) VALUES (?,?,?,'',?)").bind(uid, email, name, nowIso()),
      db.prepare("INSERT INTO orgs(id, name, code, trial_ends) VALUES (?,?,?,?)").bind(oid, orgName, slug, addDays(today(), TRIAL_DAYS)),
      db.prepare("INSERT INTO members(org_id, user_id, role) VALUES (?,?, 'owner')").bind(oid, uid),
      db.prepare("INSERT INTO app_config(org_id, data) VALUES (?,?)").bind(oid, JSON.stringify(starterConfig(name))),
    ]);
    await logEvent(db, "signup", oid, email, `Companie nouă: ${orgName} (${slug}.espace.md)`);
    const url = await passwordLink(db, request, uid, 72, { slug });
    const mailed = await sendMail(env, db, { to: email, ...mails.welcome(name, orgName, slug, url), kind: "welcome", orgId: oid, key: "welcome:" + oid });
    return json({ sent: true, email, slug, mailed });
  }

  if (fn === "auth_login") {
    const email = str(body.email, 120).toLowerCase(), pw = typeof body.password === "string" ? body.password : "";
    const k = "em:" + email;
    if (await throttled(db, k)) return json({ message: "locked" }, 429);
    const u = await one(db, "SELECT * FROM users WHERE email = ?", email);
    if (u && !u.pw_hash) { await failHit(db, k); await sleep(600); return json({ message: "not_confirmed" }, 401); }
    if (!u || !(await passwordMatches(pw, u.pw_hash))) { await failHit(db, k); await sleep(1000); return json({ message: "bad_login" }, 401); }
    await failClear(db, k);
    await run(db, "UPDATE users SET last_login = ? WHERE id = ?", nowIso(), u.id).catch(() => {});
    const orgs = await myOrgs(db, u.id);
    const want = reqSlug ? orgs.find((o: any) => o.code === reqSlug) : (orgs.find((o: any) => o.id === body.org_id) || orgs[0]);
    if (reqSlug && !want) { await failHit(db, k); await sleep(1000); return json({ message: "not_member" }, 403); }
    const token = await newSession(db, u.id, want ? want.id : "");
    const c = await loadSession(db, env, token);
    return json({ token, me: await meOf(db, c!) });
  }

  // ---------- cleaner app (company code + own PIN, sees only her own work, no money) ----------
  if (fn.startsWith("cl_")) {
    const code = (reqSlug || str(body.org, 40)).toLowerCase(), k = "cl:" + code;
    if (await throttled(db, k)) return json({ message: "locked" }, 429);
    const org = code ? await one(db, "SELECT * FROM orgs WHERE code = ?", code) : null;
    let me: any = null;
    if (org && typeof body.s_pin === "string" && body.s_pin.length >= 4)
      for (const st of await all(db, "SELECT * FROM staff WHERE org_id = ? AND active = 1 AND pin_hash != ''", org.id)) if (await pinMatches(body.s_pin, st.pin_hash)) { me = st; break; }
    if (!me) { await failHit(db, k); await sleep(1000); return json({ message: "bad_pin" }, 401); }
    const O = org.id;
    if (fn !== "cl_login" && fn !== "cl_load" && isExpired(await chargeOrg(db, org))) return json({ message: "subscription_expired" }, 402);
    const td = isDate(body.today) ? body.today : nowIso().slice(0, 10);
    if (fn === "cl_login") return json({ id: me.id, name: me.name, org: org.name });
    if (fn === "cl_push_key") return json((await getVapid(db)).pub);
    if (fn === "cl_push_sub") return json(await saveSub(db, O, body.sub, "", me.id));
    if (fn === "cl_load") return json(await cleanerView(db, O, me, td));
    if (fn === "cl_done") {
      const done = body.done !== false, t = nowIso();
      let id = isUuid(body.task_id) && (await one(db, "SELECT id FROM tasks WHERE org_id = ? AND id = ?", O, body.task_id)) ? body.task_id : null;
      if (!id && isUuid(body.booking_id)) { const ex = await one(db, "SELECT id FROM tasks WHERE org_id = ? AND kind = 'clean' AND booking_id = ? AND date = ?", O, body.booking_id, str(body.date, 10)); id = ex?.id || null; }
      if (id) await run(db, "UPDATE tasks SET status = ?, staff_id = ?, done_at = ?, updated_at = ? WHERE org_id = ? AND id = ?", done ? "done" : "todo", me.id, done ? t : null, t, O, id);
      else {
        if (!isUuid(body.booking_id) || !isDate(body.date) || !str(body.apt)) return json({ message: "bad_task" }, 400);
        if (!(await one(db, "SELECT id FROM bookings WHERE org_id = ? AND id = ?", O, body.booking_id))) return json({ message: "bad_task" }, 400);
        id = uuid();
        await run(db, "INSERT INTO tasks(id,org_id,kind,date,apt,staff_id,status,booking_id,done_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", id, O, "clean", body.date, str(body.apt, 100), me.id, done ? "done" : "todo", body.booking_id, done ? t : null, t, t);
      }
      const task = await one(db, "SELECT apt, date FROM tasks WHERE org_id = ? AND id = ?", O, id);
      if (done && task && Array.isArray(body.checks)) for (const c of body.checks.slice(0, 30))
        await run(db, "INSERT OR IGNORE INTO checks(org_id,apt,item,date,staff_id) VALUES (?,?,?,?,?)", O, task.apt, str(c, 20), task.date, me.id);
      if (done && task) waitUntil(notify(db, O, ["manager"], { title: "✓ Убрано: " + task.apt, body: me.name + " · " + localNow().hm, tag: "done-" + id }).catch(() => {}));
      return json(id);
    }
    if (fn === "cl_report") {
      const apt = str(body.apt, 100), note = str(body.note, 500), photo = typeof body.photo === "string" ? body.photo : "";
      if (!apt || !note) return json({ message: "bad_report" }, 400);
      if (photo && (!/^data:image\/(jpeg|png|webp);base64,/.test(photo) || photo.length > 400000)) return json({ message: "bad_photo" }, 400);
      const t = nowIso();
      await run(db, "INSERT INTO tasks(id,org_id,kind,date,apt,status,note,photo,reported_by,shift_person,sent,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)", uuid(), O, "repair", td, apt, "todo", note, photo, me.name, await shiftPerson(db, O), t, t);
      waitUntil(notify(db, O, ["manager"], { title: "🔧 " + apt + ": нужно починить", body: note + " — " + me.name + (photo ? " (есть фото)" : "") }).catch(() => {}));
      return json(true);
    }
    return json({ message: "not_found" }, 404);
  }

  // ---------- everything below needs a signed-in account ----------
  const c = await loadSession(db, env, bearer(request));
  if (!c) { await sleep(500); return json({ message: "bad_session" }, 401); }
  if (reqSlug && c.org && c.org.code !== reqSlug && !fn.startsWith("auth_")) return json({ message: "bad_session" }, 401);

  if (fn === "auth_me") return json(await meOf(db, c));
  if (fn === "auth_logout") { await run(db, "DELETE FROM sessions WHERE token_hash = ?", c.tokenHash); return json(true); }
  if (fn === "auth_switch") {
    const m = await one(db, "SELECT org_id FROM members WHERE user_id = ? AND org_id = ?", c.user.id, str(body.org_id, 40));
    if (!m) return json({ message: "not_member" }, 403);
    await run(db, "UPDATE sessions SET org_id = ? WHERE token_hash = ?", m.org_id, c.tokenHash);
    return json(await meOf(db, (await loadSession(db, env, bearer(request)))!));
  }
  if (fn === "auth_password") {
    const u = await one(db, "SELECT pw_hash FROM users WHERE id = ?", c.user.id);
    const np = typeof body.new_password === "string" ? body.new_password : "";
    if (!(await passwordMatches(String(body.old_password || ""), u.pw_hash))) { await sleep(1000); return json({ message: "bad_password" }, 401); }
    if (np.length < 8 || np.length > 128) return json({ message: "pw_too_short" }, 400);
    await run(db, "UPDATE users SET pw_hash = ? WHERE id = ?", await hashPassword(np), c.user.id);
    await run(db, "DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", c.user.id, c.tokenHash); // sign out everywhere else
    return json(true);
  }
  // a signed-in person (e.g. the platform owner) can open one more company of their own
  if (fn === "auth_new_org") {
    const orgName = str(body.org_name, 80); if (!orgName) return json({ message: "need_names" }, 400);
    const slug = str(body.slug, 40).toLowerCase();
    if (!slugOk(slug)) return json({ message: "bad_slug" }, 400);
    if (!(await slugFree(db, slug))) return json({ message: "slug_taken" }, 409);
    const oid = uuid();
    await db.batch([
      db.prepare("INSERT INTO orgs(id, name, code, trial_ends) VALUES (?,?,?,?)").bind(oid, orgName, slug, addDays(today(), TRIAL_DAYS)),
      db.prepare("INSERT INTO members(org_id, user_id, role) VALUES (?,?, 'owner')").bind(oid, c.user.id),
      db.prepare("INSERT INTO app_config(org_id, data) VALUES (?,?)").bind(oid, JSON.stringify(starterConfig(c.user.name))),
      db.prepare("UPDATE sessions SET org_id = ? WHERE token_hash = ?").bind(oid, c.tokenHash),
    ]);
    return json(await meOf(db, (await loadSession(db, env, bearer(request)))!));
  }

  // ---------- platform owner (super-admin) ----------
  if (fn.startsWith("sa_")) {
    if (!c.isSuper || c.support) { await sleep(500); return json({ message: "forbidden" }, 403); }
    return handleAdmin(fn, body, c, db, env);
  }

  // ---------- company workspace ----------
  if (!c.org) return json({ message: "no_org" }, 409);
  const O = c.org.id, org = c.org;
  if (!roleAllows(c.role, fn)) return json({ message: "read_only" }, 403);
  // unpaid or blocked: the data stays visible, nothing can be changed
  if (isExpired(org) && !READ_FNS.includes(fn) && !fn.startsWith("team_") && fn !== "bill_invoice" && fn !== "kv_prop_load") return json({ message: "subscription_expired" }, 402);

  if (fn === "billing") {
    // the balance history: top-ups and the daily fees, the fees grouped by month
    const [payments, charges, invoices] = await Promise.all([
      all(db, "SELECT amount, months, paid_until, balance_after, note, created_at FROM payments WHERE org_id = ? ORDER BY created_at DESC LIMIT 100", O),
      all(db, "SELECT substr(day, 1, 7) AS month, COUNT(*) AS days, SUM(amount) AS amount, MIN(day) AS first, MAX(day) AS last, MAX(apts) AS apts FROM charges WHERE org_id = ? GROUP BY month ORDER BY month DESC LIMIT 24", O),
      all(db, "SELECT number, token, issued_at, due_at, amount, months, status FROM invoices WHERE org_id = ? AND status != 'void' ORDER BY created_at DESC", O),
    ]);
    return json({ ...(await billingOf(db, org)), tiers: TIERS, payments, charges, invoices });
  }
  if (fn === "bill_invoice") { // the company asks for an invoice to top up its balance
    const amount = Math.round(num(body.amount) * 100) / 100;
    if (!(amount >= 50) || amount > 100000) return json({ message: "bad_amount" }, 400);
    const open = await one(db, "SELECT COUNT(*) AS n FROM invoices WHERE org_id = ? AND status = 'sent'", O);
    if (open.n >= 5) return json({ message: "too_many_open" }, 409);
    const r = await createInvoice(db, env, org, amount, { actor: c.user.email, send: true });
    return json({ number: r.number, token: r.token, amount: r.amount, due_at: r.due_at });
  }
  if (fn === "excel" || fn === "excel_handovers") {
    const data = await loadAll(db, O);
    if (fn === "excel_handovers") return xlsx(await buildHandoverWorkbook(data.handovers as any, data.config), org.name + " — Пересменки.xlsx");
    const ym = str(body.month, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) return json({ message: "bad_month" }, 400);
    return xlsx(await buildMonthWorkbook(ym, data.bookings as any, data.config, data.expenses as any), org.name + " — " + monthTitle(ym) + ".xlsx");
  }

  // ---------- team (owner only) ----------
  if (fn === "team_list") {
    return json(await all(db, "SELECT u.id, u.email, u.name, m.role, m.created_at FROM members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? ORDER BY m.created_at", O));
  }
  if (fn === "team_add") { // a new person gets an email with a link to set a password; an existing account is only given access
    const email = str(body.email, 120).trim().toLowerCase(), name = str(body.name, 60), role = ROLES.includes(body.role) && body.role !== "owner" ? body.role : "manager";
    if (!isEmail(email)) return json({ message: "bad_email" }, 400);
    let u = await one(db, "SELECT id, pw_hash FROM users WHERE email = ?", email), invited = false;
    if (!u) {
      if (!name) return json({ message: "need_names" }, 400);
      u = { id: uuid(), pw_hash: "" };
      await run(db, "INSERT INTO users(id, email, name, pw_hash) VALUES (?,?,?,'')", u.id, email, name);
      invited = true;
    }
    { const m = await one(db, "SELECT role FROM members WHERE org_id = ? AND user_id = ?", O, u.id); // an apartment owner's access never replaces a team member's role
      if (m && (m.role === "prop") !== (role === "prop")) return json({ message: "already_member" }, 409); }
    await run(db, "INSERT INTO members(org_id, user_id, role) VALUES (?,?,?) ON CONFLICT (org_id, user_id) DO UPDATE SET role = excluded.role", O, u.id, role);
    const url = u.pw_hash ? orgUrlOf(org.code, request) : await passwordLink(db, request, u.id, 72, { slug: org.code });
    await audit(db, O, c, "team", "add", u.id, email, { role });
    const mailed = await sendMail(env, db, { to: email, ...(role === "prop" ? mails.inviteProp(org.name, org.code, url, !u.pw_hash) : mails.invite(c.user.name || c.user.email, org.name, org.code, url, !u.pw_hash)), kind: "invite", orgId: O });
    return json({ id: u.id, invited: invited || !u.pw_hash, mailed });
  }
  if (fn === "team_role" || fn === "team_remove") {
    const uid = str(body.user_id, 40);
    if (uid === c.user.id) return json({ message: "not_self" }, 400);
    const m = await one(db, "SELECT role FROM members WHERE org_id = ? AND user_id = ?", O, uid);
    if (!m) return json({ message: "not_found" }, 404);
    if (fn === "team_remove") {
      await run(db, "DELETE FROM members WHERE org_id = ? AND user_id = ?", O, uid);
      { const u = await one(db, "SELECT email FROM users WHERE id = ?", uid); await audit(db, O, c, "team", "remove", uid, u?.email || "", { role: m.role }); }
      await run(db, "DELETE FROM sessions WHERE user_id = ? AND org_id = ?", uid, O);
      return json(true);
    }
    const role = ROLES.includes(body.role) && body.role !== "prop" ? body.role : "manager";
    if (m.role === "prop") return json({ message: "is_prop" }, 409);
    await run(db, "UPDATE members SET role = ? WHERE org_id = ? AND user_id = ?", role, O, uid);
    { const u = await one(db, "SELECT email FROM users WHERE id = ?", uid); await audit(db, O, c, "team", "role", uid, u?.email || "", { role: [m.role, role] }); }
    return json(role);
  }

  switch (fn) {
    case "kv_load":
      return json(await loadAll(db, O));

    case "kv_save": {
      const b = body.b || {};
      if (!isDate(b.date) || !str(b.apt)) return json({ message: "bad_booking" }, 400);
      const prev = isUuid(b.id) ? await one(db, "SELECT * FROM bookings WHERE org_id = ? AND id = ?", O, b.id) : null;
      if (await monthClosed(db, O, b.date, prev?.date)) return CLOSED();
      const v = { date: b.date, apt: str(b.apt, 100), guest: str(b.guest, 200), nights: Math.min(366, Math.floor(num(b.nights))),
        mdl: num(b.mdl), eur: num(b.eur), usd: num(b.usd), pay: str(b.pay, 50), who: str(b.who, 50), note: str(b.note, 1000),
        source: str(b.source, 50), phone: str(b.phone, 40), pax: Math.max(0, Math.min(500, Math.floor(num(b.pax)))), oth: num(b.oth), oth_cur: str(b.oth_cur, 10).toUpperCase(), util: num(b.util),
        price: Math.max(0, num(b.price)), price_cur: (["MDL", "EUR", "USD"].includes(str(b.price_cur, 5).toUpperCase()) ? str(b.price_cur, 5).toUpperCase() : "EUR"), pay_status: (["unpaid", "part", "paid"].includes(str(b.pay_status, 10)) ? str(b.pay_status, 10) : ""), tag: (TAGS.includes(str(b.tag, 10)) ? str(b.tag, 10) : ""),
        util_cur: (["MDL", "EUR", "USD"].includes(str(b.util_cur, 5).toUpperCase()) ? str(b.util_cur, 5).toUpperCase() : "MDL") };
      if (isUuid(b.id)) {
        const r = await one(db, `UPDATE bookings SET verified=(verified AND mdl=? AND eur=? AND usd=? AND oth IS ? AND util=? AND pay=?),
          date=?, apt=?, guest=?, nights=?, mdl=?, eur=?, usd=?, pay=?, who=?, note=?, source=?, phone=?, pax=?, oth=?, oth_cur=?, util=?, util_cur=?, price=?, price_cur=?, pay_status=?, tag=?, updated_at=? WHERE org_id=? AND id=? RETURNING id`,
          v.mdl, v.eur, v.usd, v.oth, v.util, v.pay,
          v.date, v.apt, v.guest, v.nights, v.mdl, v.eur, v.usd, v.pay, v.who, v.note, v.source, v.phone, v.pax, v.oth, v.oth_cur, v.util, v.util_cur, v.price, v.price_cur, v.pay_status, v.tag, nowIso(), O, b.id);
        if (r?.id && prev) { const d = diffOf(prev, v, B_F); if (Object.keys(d).length) await audit(db, O, c, "booking", "update", b.id, bLabel(v), d); }
        return json(r?.id ?? null);
      }
      const id = uuid(), t = nowIso();
      await run(db, "INSERT INTO bookings(id,org_id,date,apt,guest,nights,mdl,eur,usd,pay,who,note,source,phone,pax,oth,oth_cur,util,util_cur,price,price_cur,pay_status,tag,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id, O, v.date, v.apt, v.guest, v.nights, v.mdl, v.eur, v.usd, v.pay, v.who, v.note, v.source, v.phone, v.pax, v.oth, v.oth_cur, v.util, v.util_cur, v.price, v.price_cur, v.pay_status, v.tag, t, t);
      await audit(db, O, c, "booking", "create", id, bLabel(v), snapOf(v, B_F));
      return json(id);
    }
    case "kv_verify": {
      // action: ok (checked) · undo (take the check back, reason required) · problem (money doesn't match, reason required)
      if (!isUuid(body.p_id)) return json({ message: "bad_id" }, 400);
      const kind = body.kind === "shift" ? "shift" : "booking", tbl = kind === "shift" ? "handovers" : "bookings";
      const action = ["ok", "undo", "problem"].includes(body.action) ? body.action : (body.ok === true ? "ok" : "undo");
      const who = str(body.who, 50) || c.user.name, note = str(body.note, 500), t = nowIso();
      if (action !== "ok" && !note) return json({ message: "need_note" }, 400);
      const obj = await one(db, `SELECT * FROM ${tbl} WHERE org_id = ? AND id = ?`, O, body.p_id);
      if (!obj) return json({ message: "not_found" }, 404);
      if (await monthClosed(db, O, kind === "shift" ? obj.date_to : obj.date)) return CLOSED();
      const snap = JSON.stringify(kind === "shift" ? { rows: obj.rows } : { mdl: obj.mdl, eur: obj.eur, usd: obj.usd, oth: obj.oth, oth_cur: obj.oth_cur, util: obj.util, pay: obj.pay, nights: obj.nights, date: obj.date, apt: obj.apt });
      await run(db, `UPDATE ${tbl} SET verified=?, verified_at=? WHERE org_id = ? AND id=?`, action === "ok" ? 1 : 0, action === "ok" ? t : null, O, body.p_id);
      await run(db, `INSERT INTO verify_info(org_id, kind, ref_id, state, who, at, note, snap) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT (org_id, kind, ref_id) DO UPDATE SET state=excluded.state, who=excluded.who, at=excluded.at, note=excluded.note, snap=excluded.snap`,
        O, kind, body.p_id, action === "ok" ? "ok" : action === "problem" ? "problem" : "", who, t, note, snap);
      await run(db, "INSERT INTO verify_log(org_id, kind, ref_id, action, who, note, at) VALUES (?,?,?,?,?,?,?)", O, kind, body.p_id, action, who, note, t).catch(() => {});
      if (action === "problem") {
        const what = kind === "shift" ? `Смена ${obj.person || ""} ${obj.date_from.slice(8, 10)}.${obj.date_from.slice(5, 7)}–${obj.date_to.slice(8, 10)}.${obj.date_to.slice(5, 7)}` : `${obj.apt} · ${obj.guest || "без имени"} · ${obj.date.slice(8, 10)}.${obj.date.slice(5, 7)}`;
        await run(db, "INSERT INTO todos(id, org_id, text, apt, due_date, created_by) VALUES (?,?,?,?,?,?)", uuid(), O, `⚠ Оплата не сходится: ${what} — ${note}`, kind === "shift" ? "" : obj.apt, t.slice(0, 10), who || "Проверка оплат").catch(() => {});
        waitUntil(notify(db, O, ["manager"], { title: "⚠ Не сходится: " + what, body: note + (who ? " — " + who : "") }).catch(() => {}));
      }
      return json(body.p_id);
    }
    case "kv_month_close": {
      const ym = str(body.ym, 7); if (!/^\d{4}-\d{2}$/.test(ym)) return json({ message: "bad_month" }, 400);
      const who = str(body.who, 50) || c.user.name, t = nowIso();
      await run(db, "INSERT INTO month_close(org_id, ym, who, at) VALUES (?,?,?,?) ON CONFLICT (org_id, ym) DO UPDATE SET who=excluded.who, at=excluded.at", O, ym, who, t);
      await run(db, "INSERT INTO verify_log(org_id, kind, ref_id, action, who, note, at) VALUES (?,'month',?,?,?,?,?)", O, ym, "close", who, "", t).catch(() => {});
      await audit(db, O, c, "month", "close", ym, ym, {});
      const RU = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
      waitUntil(notify(db, O, ["manager"], { title: "✅ Месяц закрыт: " + RU[+ym.slice(5) - 1] + " " + ym.slice(0, 4), body: "Все оплаты и смены проверены" + (who ? " — " + who : "") }).catch(() => {}));
      return json(ym);
    }
    case "kv_month_open": {
      const ym = str(body.ym, 7), note = str(body.note, 500);
      if (!note) return json({ message: "need_note" }, 400);
      await run(db, "DELETE FROM month_close WHERE org_id = ? AND ym = ?", O, ym);
      await audit(db, O, c, "month", "open", ym, ym, { note });
      await run(db, "INSERT INTO verify_log(org_id, kind, ref_id, action, who, note, at) VALUES (?,'month',?,?,?,?,?)", O, ym, "open", str(body.who, 50) || c.user.name, note, nowIso()).catch(() => {});
      return json(ym);
    }
    case "kv_delete": {
      if (!isUuid(body.p_id)) return json({ message: "bad_id" }, 400);
      const old = await one(db, "SELECT * FROM bookings WHERE org_id = ? AND id = ?", O, body.p_id); if (await monthClosed(db, O, old?.date)) return CLOSED();
      await run(db, "DELETE FROM bookings WHERE org_id = ? AND id = ?", O, body.p_id);
      if (old) await audit(db, O, c, "booking", "delete", body.p_id, bLabel(old), snapOf(old, B_F));
      return json(null);
    }
    case "kv_save_expense": {
      const e = body.e || {};
      if (!isDate(e.date) || !str(e.category)) return json({ message: "bad_expense" }, 400);
      const prev = isUuid(e.id) ? await one(db, "SELECT * FROM expenses WHERE org_id = ? AND id = ?", O, e.id) : null;
      if (await monthClosed(db, O, e.date, prev?.date)) return CLOSED();
      const v = { date: e.date, apt: str(e.apt, 100), category: str(e.category, 60), mdl: num(e.mdl), eur: num(e.eur), usd: num(e.usd),
        who: str(e.who, 50), note: str(e.note, 1000), oth: num(e.oth), oth_cur: str(e.oth_cur, 10).toUpperCase(), yearly: e.yearly === true ? 1 : 0 };
      if (isUuid(e.id)) {
        const r = await one(db, "UPDATE expenses SET date=?, apt=?, category=?, mdl=?, eur=?, usd=?, who=?, note=?, oth=?, oth_cur=?, yearly=?, updated_at=? WHERE org_id=? AND id=? RETURNING id",
          v.date, v.apt, v.category, v.mdl, v.eur, v.usd, v.who, v.note, v.oth, v.oth_cur, v.yearly, nowIso(), O, e.id);
        if (r?.id && prev) { const d = diffOf(prev, v, E_F); if (Object.keys(d).length) await audit(db, O, c, "expense", "update", e.id, eLabel(v), d); }
        if (r?.id || !e.new) return json(r?.id ?? null);
      }
      // a client-made id (e.new) is kept only if nobody has it yet
      const id = isUuid(e.id) && e.new && !(await one(db, "SELECT 1 AS x FROM expenses WHERE id = ?", e.id)) ? e.id : uuid(), t = nowIso();
      await run(db, "INSERT INTO expenses(id,org_id,date,apt,category,mdl,eur,usd,who,note,oth,oth_cur,yearly,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id, O, v.date, v.apt, v.category, v.mdl, v.eur, v.usd, v.who, v.note, v.oth, v.oth_cur, v.yearly, t, t);
      await audit(db, O, c, "expense", "create", id, eLabel(v), snapOf(v, E_F));
      return json(id);
    }
    case "kv_delete_expense": {
      if (!isUuid(body.p_id)) return json({ message: "bad_id" }, 400);
      const old = await one(db, "SELECT * FROM expenses WHERE org_id = ? AND id = ?", O, body.p_id); if (await monthClosed(db, O, old?.date)) return CLOSED();
      await run(db, "DELETE FROM expenses WHERE org_id = ? AND id = ?", O, body.p_id);
      if (old) await audit(db, O, c, "expense", "delete", body.p_id, eLabel(old), snapOf(old, E_F));
      return json(null);
    }
    case "kv_save_handover": {
      const h = body.h || {};
      if (!isDate(h.date_from) || !isDate(h.date_to)) return json({ message: "bad_period" }, 400);
      const cols = (Array.isArray(h.cols) ? h.cols : []).map((x: unknown) => str(x, 10).toUpperCase()).filter(Boolean).slice(0, 8);
      const rows = (Array.isArray(h.rows) ? h.rows : []).slice(0, 300).map((r: any) => {
        const o: any = { apt: str(r?.apt, 100), note: str(r?.note, 200) };
        if (isUuid(r?.bid)) o.bid = r.bid;
        if (isDate(r?.d)) { o.d = r.d; o.n = Math.max(1, Math.min(60, Math.floor(num(r?.n)) || 1)); }
        if (r?.guest) o.guest = str(r.guest, 100);
        if (r?.src) o.src = str(r.src, 50);
        if (r?.nw) o.nw = 1;
        if (r?.adopt) o.adopt = 1;
        if (isUuid(r?.dop)) { o.dop = r.dop; if (o.d) o.n = 0; }
        if (snum(r?.abnb) > 0) o.abnb = snum(r.abnb);
        if (r?.kind === "exp") { o.kind = "exp"; o.cat = str(r?.cat, 60) || "Прочее"; }
        if (isUuid(r?.eid)) o.eid = r.eid;
        if (isDate(r?.ed)) o.ed = r.ed;
        if (snum(r?.util) > 0) { o.util = snum(r.util); o.ucur = ["EUR", "USD"].includes(str(r?.ucur, 5)) ? str(r.ucur, 5) : "MDL"; }
        for (const k of MONEY_KEYS) o[k] = snum(r?.[k]);
        if (o.kind !== "exp") {
          const cg: any = {};
          if (r?.chgs && typeof r.chgs === "object") for (const k of ["mdl", "eur", "usd"]) { const x = snum(r.chgs[k]); if (x > 0) cg[k] = x; }
          else if (snum(r?.chg) > 0 && ["mdl", "eur", "usd"].includes(r?.chgcur)) cg[r.chgcur] = snum(r.chg);
          if (Object.keys(cg).length) o.chgs = cg;
        }
        o.oth = {}; for (const cc of cols) { const x = snum(r?.oth?.[cc]); if (x) o.oth[cc] = x; }
        return o;
      });
      const v = { title: str(h.title, 40), person: str(h.person, 50), note: str(h.note, 500), rows: JSON.stringify(rows), cols: JSON.stringify(cols), closed: h.closed === true ? 1 : 0 };
      if (isUuid(h.id)) {
        const prevH = await one(db, "SELECT rows, verified FROM handovers WHERE org_id = ? AND id = ?", O, h.id);
        if (prevH && prevH.verified && prevH.rows !== v.rows) await run(db, "UPDATE handovers SET verified = 0 WHERE org_id = ? AND id = ?", O, h.id);
        const r = await one(db, "UPDATE handovers SET title=?, person=?, date_from=?, date_to=?, rows=?, cols=?, note=?, closed=?, updated_at=? WHERE org_id=? AND id=? RETURNING id",
          v.title, v.person, h.date_from, h.date_to, v.rows, v.cols, v.note, v.closed, nowIso(), O, h.id);
        if (r) { await syncShift(db, O, r.id, v.person, rows); return json(r.id); }
      }
      const id = isUuid(h.id) && !(await one(db, "SELECT 1 AS x FROM handovers WHERE id = ?", h.id)) ? h.id : uuid(), t = nowIso();
      await run(db, "INSERT INTO handovers(id,org_id,title,person,date_from,date_to,rows,cols,note,closed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        id, O, v.title, v.person, h.date_from, h.date_to, v.rows, v.cols, v.note, v.closed, t, t);
      await syncShift(db, O, id, v.person, rows);
      return json(id);
    }
    case "kv_delete_handover": {
      if (!isUuid(body.p_id)) return json({ message: "bad_id" }, 400);
      await db.batch([
        // deleting a shift removes what it put into the calendar and the expenses;
        // a booking that was already in the calendar before the shift took it over stays (only unlinked)
        db.prepare("DELETE FROM bookings WHERE org_id = ? AND shift_id = ? AND shift_adopted = 0").bind(O, body.p_id),
        db.prepare("UPDATE bookings SET shift_id = NULL, shift_adopted = 0 WHERE org_id = ? AND shift_id = ?").bind(O, body.p_id),
        db.prepare("DELETE FROM expenses WHERE org_id = ? AND shift_id = ?").bind(O, body.p_id),
        db.prepare("DELETE FROM handovers WHERE org_id = ? AND id = ?").bind(O, body.p_id),
      ]);
      return json(null);
    }
    case "kv_photos": {
      const rows = await all(db, "SELECT apt, data FROM apt_photos WHERE org_id = ?", O);
      return json(Object.fromEntries(rows.map((r: any) => [r.apt, r.data])));
    }
    case "kv_photo_set": {
      const apt = str(body.apt, 100), data = typeof body.data === "string" ? body.data : "";
      if (!apt) return json({ message: "bad_apt" }, 400);
      if (!data) { await run(db, "DELETE FROM apt_photos WHERE org_id = ? AND apt = ?", O, apt); return json(null); }
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(data) || data.length > 400000) return json({ message: "bad_photo" }, 400);
      await run(db, "INSERT INTO apt_photos(org_id,apt,data,updated_at) VALUES (?,?,?,?) ON CONFLICT (org_id, apt) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at", O, apt, data, nowIso());
      return json(null);
    }
    // ---------- guest guide ----------
    case "kv_guides": {
      const g = await all(db, "SELECT apt, token, data, updated_at FROM guides WHERE org_id = ?", O);
      const m = await all(db, "SELECT id, apt FROM guide_media WHERE org_id = ? ORDER BY created_at", O);
      const out: any = {};
      for (const r of g) { let d: any = {}; try { d = JSON.parse(r.data); } catch {} out[r.apt] = { token: r.token, data: d, updated_at: r.updated_at, media: [] }; }
      for (const r of m) (out[r.apt] ||= { token: "", data: {}, media: [] }).media.push(r.id);
      return json(out);
    }
    case "kv_guide_save": {
      const apt = str(body.apt, 100);
      if (!apt) return json({ message: "bad_apt" }, 400);
      const data = JSON.stringify(body.data && typeof body.data === "object" ? body.data : {});
      if (data.length > 200000) return json({ message: "too_big" }, 400);
      const ex = await one(db, "SELECT token FROM guides WHERE org_id = ? AND apt = ?", O, apt);
      const token = ex?.token || guideToken();
      await run(db, "INSERT INTO guides(org_id,apt,token,data,updated_at) VALUES (?,?,?,?,?) ON CONFLICT (org_id, apt) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at", O, apt, token, data, nowIso());
      return json(token);
    }
    case "kv_guide_media_add": {
      const apt = str(body.apt, 100), data = typeof body.data === "string" ? body.data : "";
      if (!apt) return json({ message: "bad_apt" }, 400);
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(data) || data.length > 400000) return json({ message: "bad_photo" }, 400);
      const id = uuid();
      await run(db, "INSERT INTO guide_media(id,org_id,apt,data,created_at) VALUES (?,?,?,?,?)", id, O, apt, data, nowIso());
      if (!(await one(db, "SELECT 1 AS x FROM guides WHERE org_id = ? AND apt = ?", O, apt))) await run(db, "INSERT INTO guides(org_id,apt,token,data,updated_at) VALUES (?,?,?,'{}',?)", O, apt, guideToken(), nowIso());
      return json(id);
    }
    case "kv_guide_media_del": {
      if (!isUuid(body.p_id)) return json({ message: "bad_id" }, 400);
      await run(db, "DELETE FROM guide_media WHERE org_id = ? AND id = ?", O, body.p_id);
      return json(null);
    }
    case "kv_check_add": { // manager marks a checklist item as done (the maid forgot to tick it)
      const apt = str(body.apt, 100), item = str(body.item, 20);
      if (!apt || !item || !isDate(body.date)) return json({ message: "bad_check" }, 400);
      await run(db, "INSERT OR IGNORE INTO checks(org_id,apt,item,date,staff_id) VALUES (?,?,?,?,?)", O, apt, item, body.date, isUuid(body.staff_id) ? body.staff_id : null);
      return json(null);
    }
    case "kv_set_config": {
      const d = body.p_data;
      if (!d || typeof d !== "object" || !Array.isArray(d.apts) || !d.apts.length) return json({ message: "bad_config" }, 400);
      // export-link keys are made on the server; an app with an older copy of the settings must not drop them
      const prevCfg = await getConfig(db, O);
      { const old = prevCfg;
        for (const [apt, u] of Object.entries<any>(old?.units || {})) if (u?.ical && d.apts.includes(apt)) { d.units = d.units || {}; d.units[apt] = { ...(d.units[apt] || {}), ical: d.units[apt]?.ical || u.ical }; } }
      const s = JSON.stringify(d); if (s.length > 300000) return json({ message: "too_big" }, 400);
      // over 70 apartments the price is individual — the platform owner sets it up by hand
      if (d.apts.length > 70 && !(Number(org.custom_price) > 0)) return json({ message: "too_many_apts" }, 409);
      await run(db, "INSERT INTO app_config(org_id,data) VALUES (?,?) ON CONFLICT (org_id) DO UPDATE SET data = excluded.data", O, s);
      { const keys = [...new Set([...Object.keys(prevCfg || {}), ...Object.keys(d)])].filter((k) => JSON.stringify((prevCfg || {})[k] ?? null) !== JSON.stringify(d[k] ?? null));
        const aptsAdded = d.apts.filter((a: string) => !(prevCfg?.apts || []).includes(a)), aptsRemoved = (prevCfg?.apts || []).filter((a: string) => !d.apts.includes(a));
        if (keys.length) await audit(db, O, c, "settings", "update", "", keys.join(", "), { keys, aptsAdded, aptsRemoved }); }
      return json(null);
    }
    case "kv_req_decide": { // confirm or decline a guest's request from the booking page; the guest gets an email
      const b = await one(db, "SELECT * FROM bookings WHERE org_id = ? AND id = ? AND tag = 'req'", O, str(body.id, 40));
      if (!b) return json({ message: "not_found" }, 404);
      const cfg = (await getConfig(db, O)) || {}, dir = cfg.direct || {};
      if (body.ok === true) await run(db, "UPDATE bookings SET tag = '', updated_at = ? WHERE id = ?", nowIso(), b.id);
      else await run(db, "DELETE FROM bookings WHERE id = ?", b.id);
      await audit(db, O, c, "booking", body.ok === true ? "confirm" : "decline", b.id, bLabel(b), { nights: b.nights, price: b.price, price_cur: b.price_cur });
      let mailed = "";
      const g = body.ok === true ? await one(db, "SELECT token FROM guides WHERE org_id = ? AND apt = ?", O, b.apt) : null;
      if (b.email) mailed = await sendMail(env, db, { to: b.email, ...mails.requestAnswer(org.name, body.ok === true, { apt: b.apt, date: b.date, nights: b.nights, price: b.price, cur: b.price_cur, phone: dir.phone || "", email: dir.email || "", note: str(body.note, 300), guide: g ? `https://espace.md/g/${g.token}` : "" }), kind: "request", orgId: O });
      return json({ ok: true, mailed });
    }
    // ---------- import bookings from a spreadsheet (Excel / CSV / RealtyCalendar export), parsed in the app ----------
    case "kv_import": {
      const rows = Array.isArray(body.rows) ? body.rows.slice(0, 3000) : [];
      if (!rows.length) return json({ message: "empty" }, 400);
      const cfg = (await getConfig(db, O)) || { apts: [] };
      const apts: string[] = [...(cfg.apts || [])], added: string[] = [];
      const SRC: Record<string, string> = { airbnb: "Airbnb", booking: "Booking", "booking.com": "Booking", instagram: "Instagram", direct: "Прямой", direct_: "Прямой", "прямой": "Прямой", "direct booking": "Прямой" };
      const ok: any[] = [], bad: number[] = [];
      rows.forEach((r: any, i: number) => {
        const apt = str(r.apt, 100).trim(), date = isDate(r.date) ? r.date : "", nights = Math.floor(num(r.nights));
        if (!apt || !date || !(nights >= 0 && nights <= 366)) { bad.push(i); return; }
        if (!apts.includes(apt)) { if (body.create !== true) { bad.push(i); return; } apts.push(apt); added.push(apt); }
        const src = str(r.source, 50).trim();
        ok.push({ apt, date, nights, guest: str(r.guest, 200).trim(), phone: str(r.phone, 40).trim(), email: isEmail(str(r.email, 120)) ? str(r.email, 120).toLowerCase() : "",
          pax: Math.max(0, Math.min(500, Math.floor(num(r.pax)))), price: Math.max(0, num(r.price)), price_cur: ["EUR", "MDL", "USD"].includes(str(r.cur, 5).toUpperCase()) ? str(r.cur, 5).toUpperCase() : "EUR",
          source: SRC[src.toLowerCase()] || src, note: str(r.note, 500).trim() });
      });
      if (apts.length > 70 && !(Number(org.custom_price) > 0)) return json({ message: "too_many_apts", count: apts.length }, 409);
      if (added.length) { cfg.apts = apts; await run(db, "INSERT INTO app_config(org_id,data) VALUES (?,?) ON CONFLICT (org_id) DO UPDATE SET data = excluded.data", O, JSON.stringify(cfg)); }
      // the same stay (unit, date, nights) already in the calendar is skipped, so importing the same file twice is harmless
      const have = new Set((await all(db, "SELECT apt, date, nights FROM bookings WHERE org_id = ?", O)).map((b: any) => `${b.apt}|${b.date}|${b.nights}`));
      const closed = new Set((await all(db, "SELECT ym FROM month_close WHERE org_id = ?", O)).map((r: any) => r.ym));
      let created = 0, dup = 0, inClosed = 0; const now = nowIso(), stmts: D1PreparedStatement[] = [];
      for (const b of ok) {
        if (closed.has(b.date.slice(0, 7))) { inClosed++; continue; } // checked months stay as they are
        const k = `${b.apt}|${b.date}|${b.nights}`; if (have.has(k)) { dup++; continue; } have.add(k);
        stmts.push(db.prepare(`INSERT INTO bookings(id, org_id, date, apt, guest, nights, phone, email, pax, price, price_cur, pay_status, source, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(uuid(), O, b.date, b.apt, b.guest, b.nights, b.phone, b.email, b.pax, b.price, b.price_cur, b.price ? "unpaid" : "", b.source, b.note, now, now));
        created++;
      }
      for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
      if (created || added.length) await audit(db, O, c, "import", "import", "", `${created}`, { created, dup, closed: inClosed, bad: bad.length, aptsAdded: added });
      return json({ created, dup, closed: inClosed, bad: bad.length, badRows: bad.slice(0, 20), aptsAdded: added });
    }
    // ---------- Telegram for this person in this company ----------
    // ---------- rental contracts with guests ----------
    case "kv_contract_get": { // the booking's contract, if any
      const k = await one(db, "SELECT token, number, status, lang, guest_name, guest_doc, guest_country, signed_at, views, created_at FROM contracts WHERE org_id = ? AND booking_id = ?", O, str(body.booking_id, 40));
      return json(k ? { ...k, url: `https://${org.code}.espace.md/contract/${k.token}` } : null);
    }
    case "kv_contract_preview": { // the standard text, to start editing from
      const l = ["ro", "ru", "en"].includes(body.lang) ? body.lang : "ro";
      return json({ text: (DEFAULT_TPL as any)[l] });
    }
    case "kv_contract": { // make (or refresh, while unsigned) the booking's contract; optionally email the link to the guest
      const b = await one(db, "SELECT * FROM bookings WHERE org_id = ? AND id = ?", O, str(body.booking_id, 40));
      if (!b || !(b.nights > 0) || b.tag === "closed") return json({ message: "not_found" }, 404);
      const cfg = (await getConfig(db, O)) || {};
      let k = await one(db, "SELECT token, number, status FROM contracts WHERE org_id = ? AND booking_id = ?", O, b.id);
      if (!k) {
        const y = today().slice(0, 4), n = await one(db, "SELECT COUNT(*) AS n FROM contracts WHERE org_id = ? AND number LIKE ?", O, `%/${y}`);
        k = { token: randHex(16), number: `${(n?.n || 0) + 1}/${y}`, status: "sent" };
        await run(db, "INSERT INTO contracts(token, org_id, booking_id, number, texts) VALUES (?,?,?,?,?)", k.token, O, b.id, k.number, JSON.stringify(contractTexts(cfg, org.name, b, k.number, today())));
        await audit(db, O, c, "booking", "contract", b.id, bLabel(b), { number: k.number });
      } else if (k.status !== "signed") await run(db, "UPDATE contracts SET texts = ? WHERE token = ?", JSON.stringify(contractTexts(cfg, org.name, b, k.number, today())), k.token);
      const url = `https://${org.code}.espace.md/contract/${k.token}`;
      let mailed = "";
      const to = str(body.email, 200).trim() || b.email;
      if (body.send === true && k.status !== "signed") {
        if (!isEmail(to)) return json({ message: "no_email", url, token: k.token, number: k.number, status: k.status }, 400);
        mailed = await sendMail(env, db, { to, ...mails.contractLink(org.name, { number: k.number, apt: b.apt, date: b.date, nights: b.nights, url }), kind: "contract", orgId: O });
      }
      return json({ token: k.token, number: k.number, status: k.status, url, mailed });
    }
    // ---------- change log ----------
    case "kv_audit": { // newest first, 100 at a time; filter by kind, by one record, or by text
      const before = Math.floor(num(body.before)) || 0, kind = str(body.kind, 20), ref = str(body.ref, 60), q = str(body.q, 60).trim();
      const where = ["org_id = ?"], args: any[] = [O];
      if (before > 0) { where.push("id < ?"); args.push(before); }
      if (kind === "other") where.push("kind NOT IN ('booking', 'expense')"); else if (kind) { where.push("kind = ?"); args.push(kind); }
      if (ref) { where.push("ref = ?"); args.push(ref); }
      if (q) { where.push("(label LIKE ? OR who LIKE ? OR data LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
      return json(await all(db, `SELECT id, at, who, kind, action, ref, label, data FROM audit WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT 100`, ...args));
    }
    // ---------- monthly statements for apartment owners ----------
    // ---------- an apartment owner's own view (role "prop"): their apartments only, no phones, no other units ----------
    case "kv_prop_load": {
      const cfg = (await getConfig(db, O)) || {};
      const ow = (cfg.owners || []).find((x: any) => x && String(x.email || "").trim().toLowerCase() === String(c.user.email).toLowerCase());
      if (!ow) return json({ message: "no_owner", company: org.name }, 404);
      const apts: string[] = (ow.apts || []).filter((a: string) => (cfg.apts || []).includes(a));
      const from = addDays(today(), -430), till = addDays(today(), 400);
      let bookings: any[] = [], expenses: any[] = [];
      if (apts.length) {
        const q = apts.map(() => "?").join(",");
        bookings = (await all(db, `SELECT date, apt, nights, guest, source, tag, mdl, eur, usd, oth, oth_cur, util, util_cur FROM bookings WHERE org_id = ? AND apt IN (${q}) AND date >= ? AND date < ? AND tag != 'req' ORDER BY date`, O, ...apts, from, till))
          .map((b: any) => ({ ...b, guest: b.tag === "closed" ? "" : String(b.guest || "").trim().split(/\s+/)[0].slice(0, 30) }));
        expenses = await all(db, `SELECT date, apt, category, note, mdl, eur, usd, oth, oth_cur, yearly FROM expenses WHERE org_id = ? AND apt IN (${q}) AND date >= ? AND date < ? ORDER BY date`, O, ...apts, addDays(from, -366), till);
      }
      const reports = await all(db, "SELECT ym, token, sent_at, updated_at FROM owner_reports WHERE org_id = ? AND owner_id = ? ORDER BY ym DESC", O, ow.id);
      const payouts = await all(db, "SELECT ym, amount, method, paid_on FROM owner_payouts WHERE org_id = ? AND owner_id = ? ORDER BY ym DESC", O, ow.id);
      return json({ company: org.name, slug: org.code, owner: { name: ow.name, fee: +ow.fee || 0, exp: ow.exp !== false }, apts, rates: cfg.rates || { eur: 20, usd: 0.9 }, other: cfg.other || [],
        units: Object.fromEntries(apts.map((a) => { const u = (cfg.units || {})[a] || {}; return [a, { kind: u.kind || "", area: u.area || "", bedrooms: u.bedrooms || "", guests: u.guests || "" }]; })),
        bookings, expenses, reports, payouts });
    }
    case "kv_owner_payouts": { // payouts made to owners (all of them, or one owner)
      const oid = str(body.owner, 40);
      return json(oid ? await all(db, "SELECT * FROM owner_payouts WHERE org_id = ? AND owner_id = ? ORDER BY ym DESC", O, oid)
        : await all(db, "SELECT * FROM owner_payouts WHERE org_id = ? ORDER BY ym DESC LIMIT 2000", O));
    }
    case "kv_owner_pay": { // mark a month as paid to the owner (or undo it); optionally tell the owner by email
      const ym = str(body.ym, 7), oid = str(body.owner, 40);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) return json({ message: "bad_month" }, 400);
      const cfg = (await getConfig(db, O)) || {}, ow = (cfg.owners || []).find((x: any) => x && x.id === oid);
      if (!ow) return json({ message: "no_owner" }, 404);
      if (body.undo === true) {
        const was = await one(db, "SELECT amount, method, paid_on FROM owner_payouts WHERE org_id = ? AND owner_id = ? AND ym = ?", O, oid, ym);
        await run(db, "DELETE FROM owner_payouts WHERE org_id = ? AND owner_id = ? AND ym = ?", O, oid, ym);
        if (was) await audit(db, O, c, "owner", "unpay", oid, `${ow.name} · ${ym}`, was);
        return json(true);
      }
      const amount = Math.round(num(body.amount) * 100) / 100, method = ["bank", "cash", "card"].includes(body.method) ? body.method : "bank";
      const paidOn = isDate(body.paid_on) ? body.paid_on : today();
      if (!(amount >= 0) || amount > 10000000) return json({ message: "bad_amount" }, 400);
      await run(db, `INSERT INTO owner_payouts(org_id, owner_id, ym, amount, method, note, paid_on, by_name) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT (org_id, owner_id, ym) DO UPDATE SET amount = excluded.amount, method = excluded.method, note = excluded.note, paid_on = excluded.paid_on, by_name = excluded.by_name`,
        O, oid, ym, amount, method, str(body.note, 200), paidOn, str(c.user.name || c.user.email, 60));
      await audit(db, O, c, "owner", "pay", oid, `${ow.name} · ${ym}`, { amount, method, paid_on: paidOn });
      let mailed = "";
      const to = str(ow.email, 200).trim();
      if (body.notify === true && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
        const rep = await one(db, "SELECT token FROM owner_reports WHERE org_id = ? AND owner_id = ? AND ym = ?", O, oid, ym);
        mailed = await sendMail(env, db, { to, ...mails.ownerPaid(org.name, { name: ow.name, ym, amount, method, paidOn, url: rep ? `https://${org.code}.espace.md/raport/${rep.token}` : "" }), kind: "owner_paid", orgId: O });
      }
      return json({ ok: true, mailed });
    }
    case "kv_owner_reports": { // which statements exist for a month: sent when, opened how many times
      const ym = str(body.ym, 7);
      return json(await all(db, "SELECT owner_id, token, ym, updated_at, sent_at, sent_to, views, viewed_at FROM owner_reports WHERE org_id = ? AND ym = ?", O, ym));
    }
    case "kv_owner_report": { // save (or refresh) the statement the app computed, optionally email the owner the link
      const ym = str(body.ym, 7), oid = str(body.owner, 40), data = body.data;
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym) || !data || typeof data !== "object") return json({ message: "bad_report" }, 400);
      const cfg = (await getConfig(db, O)) || {};
      const ow = (cfg.owners || []).find((x: any) => x && x.id === oid);
      if (!ow) return json({ message: "no_owner" }, 404);
      const s = JSON.stringify(data); if (s.length > 200000) return json({ message: "too_big" }, 400);
      const old = await one(db, "SELECT token FROM owner_reports WHERE org_id = ? AND owner_id = ? AND ym = ?", O, oid, ym);
      const token = old?.token || randHex(16), now = nowIso();
      if (old) await run(db, "UPDATE owner_reports SET data = ?, updated_at = ? WHERE token = ?", s, now, token);
      else await run(db, "INSERT INTO owner_reports(token, org_id, owner_id, ym, data, updated_at) VALUES (?,?,?,?,?,?)", token, O, oid, ym, s, now);
      const url = `https://${org.code}.espace.md/raport/${token}`;
      let mailed = "";
      if (body.send === true) {
        const to = str(ow.email, 200).trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ message: "no_email", token, url }, 400);
        const t = data.tot || {};
        mailed = await sendMail(env, db, { to, ...mails.ownerReport(org.name, { name: ow.name, ym, pay: +t.pay || 0, inc: +t.inc || 0, nights: +t.nights || 0, url }), kind: "owner_report", orgId: O });
        await run(db, "UPDATE owner_reports SET sent_at = ?, sent_to = ? WHERE token = ?", now, to, token);
      }
      return json({ token, url, mailed });
    }
    case "kv_tg_status": {
      const name = await botName(env, db);
      const chats = await all(db, "SELECT chat_id, name, created_at FROM tg_links WHERE org_id = ? AND user_id = ?", O, c.user.id);
      return json({ configured: !!name, bot: name, chats });
    }
    case "kv_tg_link": {
      const name = await botName(env, db);
      if (!name) return json({ message: "tg_off" }, 409);
      const code = await linkCode(db, O, c.user.id);
      return json({ url: `https://t.me/${name}?start=${code}`, code });
    }
    case "kv_tg_unlink": {
      await run(db, "DELETE FROM tg_links WHERE org_id = ? AND user_id = ?", O, c.user.id);
      return json(true);
    }
    // ---------- calendar sync (iCal) for one unit ----------
    case "kv_ical_list": {
      const apt = str(body.apt, 100), cfg = await getConfig(db, O);
      const key = cfg?.units?.[apt]?.ical;
      const feeds = await all(db, "SELECT id, url, source, last_sync, last_ok, last_msg, last_count FROM ical_feeds WHERE org_id = ? AND apt = ? ORDER BY created_at", O, apt);
      return json({ feeds, export: key ? `https://espace.md/ical/${org.code}/${key}.ics` : "" });
    }
    case "kv_ical_key": { // makes (or returns) the unit's export link
      const apt = str(body.apt, 100), cfg = await getConfig(db, O);
      if (!cfg || !(cfg.apts || []).includes(apt)) return json({ message: "bad_apt" }, 400);
      cfg.units = cfg.units || {}; cfg.units[apt] = cfg.units[apt] || {};
      if (!cfg.units[apt].ical || body.renew === true) {
        cfg.units[apt].ical = newIcalKey();
        await run(db, "UPDATE app_config SET data = ? WHERE org_id = ?", JSON.stringify(cfg), O);
      }
      return json({ export: `https://espace.md/ical/${org.code}/${cfg.units[apt].ical}.ics`, key: cfg.units[apt].ical });
    }
    case "kv_ical_add": {
      const apt = str(body.apt, 100), cfg = await getConfig(db, O);
      const url = feedUrlOk(str(body.url, 1000).trim(), ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname));
      if (!cfg || !(cfg.apts || []).includes(apt)) return json({ message: "bad_apt" }, 400);
      if (!url) return json({ message: "bad_url" }, 400);
      if (await one(db, "SELECT 1 AS x FROM ical_feeds WHERE org_id = ? AND apt = ? AND url = ?", O, apt, url)) return json({ message: "feed_exists" }, 409);
      if ((await one(db, "SELECT COUNT(*) AS n FROM ical_feeds WHERE org_id = ?", O)).n >= 300) return json({ message: "too_many_feeds" }, 409);
      const id = uuid(), source = ["Airbnb", "Booking", "Vrbo", "Google", "iCal"].includes(body.source) ? body.source : sourceOf(url);
      await run(db, "INSERT INTO ical_feeds(id, org_id, apt, url, source) VALUES (?,?,?,?,?)", id, O, apt, url, source);
      const r = await syncFeed(db, await one(db, "SELECT * FROM ical_feeds WHERE id = ?", id));
      return json({ id, source, ...r });
    }
    case "kv_ical_sync": {
      const f = await one(db, "SELECT * FROM ical_feeds WHERE org_id = ? AND id = ?", O, str(body.id, 40));
      if (!f) return json({ message: "not_found" }, 404);
      return json(await syncFeed(db, f));
    }
    case "kv_ical_del": {
      const id = str(body.id, 40);
      // the bookings it brought stay, they just stop following the feed
      await run(db, "UPDATE bookings SET ext_feed = '', ext_uid = '' WHERE org_id = ? AND ext_feed = ?", O, id);
      await run(db, "DELETE FROM ical_feeds WHERE org_id = ? AND id = ?", O, id);
      return json(true);
    }
    case "kv_rename_apt": {
      const from = str(body.from, 100), to = str(body.to, 100);
      if (!from || !to || from === to) return json({ message: "bad_name" }, 400);
      const data = await getConfig(db, O);
      if (!data) return json({ message: "bad_config" }, 400);
      if (data.apts.includes(to)) return json({ message: "name_exists" }, 409);
      data.apts = data.apts.map((a: string) => (a === from ? to : a));
      if (data.addr && data.addr[from] != null) { data.addr[to] = data.addr[from]; delete data.addr[from]; }
      if (data.units && data.units[from] != null) { data.units[to] = data.units[from]; delete data.units[from]; }
      for (const ow of data.owners || []) if (Array.isArray(ow?.apts)) ow.apts = ow.apts.map((a: string) => (a === from ? to : a));
      await run(db, "UPDATE ical_feeds SET apt = ? WHERE org_id = ? AND apt = ?", to, O, from);
      await audit(db, O, c, "settings", "rename", "", `${from} → ${to}`, { from, to });
      await db.batch([
        db.prepare("UPDATE tasks SET apt = ? WHERE org_id = ? AND apt = ?").bind(to, O, from),
        db.prepare("UPDATE checks SET apt = ? WHERE org_id = ? AND apt = ?").bind(to, O, from),
        db.prepare("UPDATE app_config SET data = ? WHERE org_id = ?").bind(JSON.stringify(data), O),
        db.prepare("UPDATE bookings SET apt = ? WHERE org_id = ? AND apt = ?").bind(to, O, from),
        db.prepare("UPDATE expenses SET apt = ? WHERE org_id = ? AND apt = ?").bind(to, O, from),
        db.prepare("UPDATE apt_photos SET apt = ? WHERE org_id = ? AND apt = ?").bind(to, O, from),
        db.prepare("UPDATE guides SET apt = ? WHERE org_id = ? AND apt = ?").bind(to, O, from),
        db.prepare("UPDATE guide_media SET apt = ? WHERE org_id = ? AND apt = ?").bind(to, O, from),
      ]);
      return json(null);
    }
    case "kv_staff_save": {
      const x = body.s || {};
      const name = str(x.name, 60); if (!name) return json({ message: "bad_name" }, 400);
      const v = { name, salary: num(x.salary), extra_rate: num(x.extra_rate), cycle_start: isDate(x.cycle_start) ? x.cycle_start : "", on_days: Math.max(1, Math.min(14, Math.floor(num(x.on_days)) || 3)), off_days: Math.max(0, Math.min(14, Math.floor(num(x.off_days)) || 3)), active: x.active === false ? 0 : 1 };
      const mine = isUuid(x.id) ? await one(db, "SELECT id FROM staff WHERE org_id = ? AND id = ?", O, x.id) : null;
      if (isUuid(x.id) && !mine && (await one(db, "SELECT 1 AS k FROM staff WHERE id = ?", x.id))) return json({ message: "bad_id" }, 400);
      const id = isUuid(x.id) ? x.id : uuid();
      const newPin = typeof x.pin === "string" && x.pin ? str(x.pin, 32) : "";
      if (newPin) {
        if (newPin.length < 4) return json({ message: "pin_too_short" }, 400);
        for (const o of await all(db, "SELECT id, pin_hash FROM staff WHERE org_id = ? AND id != ? AND pin_hash != ''", O, id)) if (await pinMatches(newPin, o.pin_hash)) return json({ message: "pin_taken" }, 409);
      }
      if (mine) await run(db, "UPDATE staff SET name=?, salary=?, extra_rate=?, cycle_start=?, on_days=?, off_days=?, active=? WHERE org_id = ? AND id = ?",
        v.name, v.salary, v.extra_rate, v.cycle_start, v.on_days, v.off_days, v.active, O, id);
      else await run(db, "INSERT INTO staff(id,org_id,name,salary,extra_rate,cycle_start,on_days,off_days,active) VALUES (?,?,?,?,?,?,?,?,?)",
        id, O, v.name, v.salary, v.extra_rate, v.cycle_start, v.on_days, v.off_days, v.active);
      if (newPin) await run(db, "UPDATE staff SET pin_hash = ? WHERE org_id = ? AND id = ?", await hashPin(newPin), O, id);
      return json(id);
    }
    case "kv_task_save": {
      const x = body.t || {};
      if (!["clean", "general", "repair", "ready"].includes(x.kind) || !isDate(x.date) || !str(x.apt)) return json({ message: "bad_task" }, 400);
      const v = { kind: x.kind, date: x.date, apt: str(x.apt, 100), staff_id: isUuid(x.staff_id) ? x.staff_id : null, status: x.status === "done" ? "done" : x.status === "skip" ? "skip" : x.status === "progress" && x.kind === "repair" ? "progress" : "todo",
        done_by: str(x.done_by, 80), result: str(x.result, 500),
        time: /^\d{2}:\d{2}$/.test(x.time || "") ? x.time : "",
        note: str(x.note, 500), cost: num(x.cost), booking_id: isUuid(x.booking_id) ? x.booking_id : null, reported_by: str(x.reported_by, 60) };
      if (v.staff_id && !(await one(db, "SELECT id FROM staff WHERE org_id = ? AND id = ?", O, v.staff_id))) v.staff_id = null;
      const t = nowIso();
      let id = isUuid(x.id) ? x.id : null;
      if (!id && v.kind === "clean" && v.booking_id) { const ex = await one(db, "SELECT id FROM tasks WHERE org_id = ? AND kind = 'clean' AND booking_id = ? AND date = ?", O, v.booking_id, v.date); id = ex?.id || null; }
      const prev = id ? await one(db, "SELECT id, kind, apt, note, cost, staff_id, sent, status FROM tasks WHERE org_id = ? AND id = ?", O, id) : null;
      if (id && !prev && (await one(db, "SELECT 1 AS k FROM tasks WHERE id = ?", id))) id = null; // someone else's id: make a new one
      if (prev && prev.kind === "repair" && prev.status === "done" && v.status !== "done") await repairUnlink(db, O, prev);
      if (v.kind === "repair" && typeof x.photo === "string" && x.photo && (!/^data:image\/(jpeg|png|webp);base64,/.test(x.photo) || x.photo.length > 400000)) return json({ message: "bad_photo" }, 400);
      // any change to a cleaning list needs to be re-sent; ticking "done" doesn't
      const sent = v.kind === "repair" || v.kind === "ready" ? 1 : x.sent === true ? 1 : x.keep_sent && prev ? prev.sent : 0;
      if (prev) {
        await run(db, "UPDATE tasks SET kind=?, date=?, apt=?, staff_id=?, status=?, note=?, cost=?, booking_id=?, time=?, sent=?, done_at=CASE WHEN ?='done' THEN COALESCE(done_at, ?) ELSE NULL END, updated_at=? WHERE org_id=? AND id=?",
          v.kind, v.date, v.apt, v.staff_id, v.status, v.note, v.cost, v.booking_id, v.time, sent, v.status, t, t, O, id);
        if (v.kind === "repair") {
          if (v.status === "done" && prev.status !== "done") await run(db, "UPDATE tasks SET done_shift = ? WHERE org_id = ? AND id = ?", await shiftPerson(db, O), O, id);
          if (v.status !== "done") await run(db, "UPDATE tasks SET done_shift = '', done_by = '', result = '' WHERE org_id = ? AND id = ?", O, id);
          else await run(db, "UPDATE tasks SET done_by = ?, result = ? WHERE org_id = ? AND id = ?", v.done_by, v.result, O, id);
        }
      } else {
        id = id || uuid();
        await run(db, "INSERT INTO tasks(id,org_id,kind,date,apt,staff_id,status,note,cost,booking_id,reported_by,time,sent,done_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          id, O, v.kind, v.date, v.apt, v.staff_id, v.status, v.note, v.cost, v.booking_id, v.reported_by, v.time, sent, v.status === "done" ? t : null, t, t);
        if (v.kind === "repair") await run(db, "UPDATE tasks SET shift_person = ?, photo = ? WHERE org_id = ? AND id = ?", await shiftPerson(db, O), typeof x.photo === "string" ? x.photo : "", O, id);
      }
      return json(id);
    }
    case "kv_list_send": {
      const date = body.date, sid = body.staff_id;
      if (!isDate(date) || !isUuid(sid)) return json({ message: "bad_list" }, 400);
      const staff = await all(db, "SELECT * FROM staff WHERE org_id = ? AND active = 1 ORDER BY created_at", O);
      const me = staff.find((x: any) => x.id === sid); if (!me) return json({ message: "bad_staff" }, 400);
      const cfgL = (await getConfig(db, O)) || {}, ids = staff.map((x: any) => x.id);
      const dl = (Array.isArray(cfgL?.duty?.[date]) ? cfgL.duty[date] : cfgL?.duty?.[date] ? [cfgL.duty[date]] : []).filter((id: string) => ids.includes(id));
      const duty = dl.length ? dl[0] : (staff.find((x: any) => isDutyC(x, date, cfgL, ids))?.id || null);
      const t = nowIso();
      // checkouts of that day with no task row yet go to the cleaner on duty
      if (duty === sid) {
        const bks = await all(db, "SELECT id, apt, date, nights, created_at FROM bookings WHERE org_id = ? AND nights > 0 AND tag NOT IN ('closed','req') AND date >= ? AND date <= ? ORDER BY created_at", O, addDays(date, -400), date);
        const need = bks.filter((b: any) => addDays(b.date, b.nights) === date);
        // a second check-in in the same apartment on the same day needs a cleaning in between
        for (const a of new Set(bks.filter((b: any) => b.date === date).map((b: any) => b.apt))) { const same = bks.filter((b: any) => b.date === date && b.apt === a); need.push(...same.slice(0, -1)); }
        // a manual cleaning of that apartment on that day already covers the checkout
        for (const b of need) if (!(await one(db, "SELECT id FROM tasks WHERE org_id = ? AND kind IN ('clean','general') AND booking_id = ? AND date = ?", O, b.id, date)) && !(await one(db, "SELECT id FROM tasks WHERE org_id = ? AND kind IN ('clean','general') AND booking_id IS NULL AND apt = ? AND date = ? AND status != 'skip'", O, b.apt, date)))
          await run(db, "INSERT INTO tasks(id,org_id,kind,date,apt,staff_id,status,booking_id,sent,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,0,?,?)", uuid(), O, "clean", date, b.apt, sid, "todo", b.id, t, t);
      }
      const cond = "org_id = ? AND date = ? AND kind IN ('clean','general') AND (staff_id = ?" + (duty === sid ? " OR staff_id IS NULL)" : ")");
      const before = await one(db, `SELECT SUM(sent) AS s FROM tasks WHERE ${cond} AND status != 'skip'`, O, date, sid);
      await run(db, `UPDATE tasks SET staff_id = ?, sent = 1, updated_at = ? WHERE ${cond}`, sid, t, O, date, sid);
      const cfg = (await getConfig(db, O)) || {};
      const list = (await all(db, "SELECT apt, time, kind, status FROM tasks WHERE org_id = ? AND date = ? AND kind IN ('clean','general') AND staff_id = ? AND status != 'skip'", O, date, sid))
        .sort((a: any, b: any) => (a.time || "99").localeCompare(b.time || "99") || (cfg.apts || []).indexOf(a.apt) - (cfg.apts || []).indexOf(b.apt));
      // fill missing times: first 10:00, then +1h after the previous one
      const addH = (hm: string, h: number) => { const [x, y] = hm.split(":").map(Number); const m = Math.min(23 * 60 + 59, x * 60 + y + h * 60); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
      const rowsT = await all(db, "SELECT id, apt, time FROM tasks WHERE org_id = ? AND date = ? AND kind IN ('clean','general') AND staff_id = ? AND status != 'skip'", O, date, sid);
      const ord = [...rowsT.filter((r: any) => r.time).sort((a: any, b: any) => a.time.localeCompare(b.time)), ...rowsT.filter((r: any) => !r.time).sort((a: any, b: any) => (cfg.apts || []).indexOf(a.apt) - (cfg.apts || []).indexOf(b.apt))];
      let prevT = "";
      for (const r of ord) { if (!r.time) { r.time = prevT ? addH(prevT, 1) : "10:00"; await run(db, "UPDATE tasks SET time = ? WHERE org_id = ? AND id = ?", r.time, O, r.id); } prevT = r.time; }
      for (const x of list) x.time = (ord.find((r: any) => r.apt === x.apt) || x).time;
      list.sort((a: any, b: any) => (a.time || "99").localeCompare(b.time || "99"));
      const n = list.length, word = n === 1 ? "квартира" : n >= 2 && n <= 4 ? "квартиры" : "квартир";
      await notify(db, O, ["staff:" + sid], {
        title: (before?.s ? "📋 Изменения в списке на " : "📋 Список на ") + wdDm(date) + ` — ${n} ${word}`,
        body: n ? list.map((x: any) => (x.time ? x.time + " " : "") + x.apt + (x.kind === "general" ? " (генеральная)" : "") + (cfg.addr && cfg.addr[x.apt] ? " — " + cfg.addr[x.apt] : "")).join("\n") : "Уборок нет", tag: "list-" + date });
      return json({ n });
    }
    case "kv_todo_save": {
      const x = body.t || {};
      const text = str(x.text, 300); if (!text) return json({ message: "bad_todo" }, 400);
      const due_date = isDate(x.due_date) ? x.due_date : "", due_time = /^\d{2}:\d{2}$/.test(x.due_time || "") ? x.due_time : "";
      const id = isUuid(x.id) ? x.id : uuid();
      const r = await one(db, `INSERT INTO todos(id, org_id, text, apt, due_date, due_time, created_by) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT (id) DO UPDATE SET text=excluded.text, apt=excluded.apt, due_date=excluded.due_date, due_time=excluded.due_time, notified=0 WHERE todos.org_id = excluded.org_id RETURNING id`,
        id, O, text, str(x.apt, 100), due_date, due_time, (await shiftPerson(db, O)) || c.user.name);
      return json(r?.id ?? null);
    }
    case "kv_todo_done": {
      if (!isUuid(body.p_id)) return json({ message: "bad_id" }, 400);
      if (body.done === false) await run(db, "UPDATE todos SET done = 0, done_by = '', done_at = NULL WHERE org_id = ? AND id = ?", O, body.p_id);
      else await run(db, "UPDATE todos SET done = 1, done_by = ?, done_at = ? WHERE org_id = ? AND id = ?", (await shiftPerson(db, O)) || c.user.name, nowIso(), O, body.p_id);
      return json(null);
    }
    case "kv_todo_delete": {
      if (!isUuid(body.p_id)) return json({ message: "bad_id" }, 400);
      await run(db, "DELETE FROM todos WHERE org_id = ? AND id = ?", O, body.p_id);
      return json(null);
    }
    case "kv_push_key": return json((await getVapid(db)).pub);
    case "kv_push_sub": return json(await saveSub(db, O, body.sub, c.user.id, ""));
    case "kv_push_test": {
      await notify(db, O, ["manager"], { title: "🔔 " + org.name, body: "Уведомления работают" });
      waitUntil(runDue(db, org).catch(() => {}));
      return json(null);
    }
    case "kv_reminder_save": {
      const x = body.r || {};
      const text = str(x.text, 300), at = str(x.at, 16);
      if (!text || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) return json({ message: "bad_reminder" }, 400);
      const target = x.target === "all" || x.target === "staff" || isUuid(x.target) ? x.target : "me";
      const id = isUuid(x.id) ? x.id : uuid();
      const r = await one(db, `INSERT INTO reminders(id, org_id, at, text, target, sent) VALUES (?,?,?,?,?,0)
        ON CONFLICT (id) DO UPDATE SET at=excluded.at, text=excluded.text, target=excluded.target, sent=0 WHERE reminders.org_id = excluded.org_id RETURNING id`, id, O, at, text, target);
      return json(r?.id ?? null);
    }
    case "kv_reminder_delete": {
      if (!isUuid(body.p_id)) return json({ message: "bad_id" }, 400);
      await run(db, "DELETE FROM reminders WHERE org_id = ? AND id = ?", O, body.p_id);
      return json(null);
    }
    case "kv_task_delete": {
      if (!isUuid(body.p_id)) return json({ message: "bad_id" }, 400);
      await repairUnlink(db, O, await one(db, "SELECT id, kind, apt, note, cost FROM tasks WHERE org_id = ? AND id = ?", O, body.p_id));
      await run(db, "DELETE FROM tasks WHERE org_id = ? AND id = ?", O, body.p_id);
      return json(null);
    }
    case "kv_task_photo": {
      if (!isUuid(body.p_id)) return json({ message: "bad_id" }, 400);
      const r = await one(db, "SELECT photo FROM tasks WHERE org_id = ? AND id = ?", O, body.p_id);
      return json(r?.photo || "");
    }
    default:
      return json({ message: "not_found" }, 404);
  }
};
