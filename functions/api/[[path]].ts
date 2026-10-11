// espace.md API — Cloudflare Pages Functions + D1.
// Ported from Rentwill and made multi-tenant: every query is scoped to the caller's company (org_id),
// ids sent by the browser are only ever matched together with that org_id.
import { buildMonthWorkbook, monthTitle, buildHandoverWorkbook } from "../../lib/excel";
import { newVapid, sendPush, type Vapid } from "../../lib/push";
import {
  type Env, type Ctx, json, sleep, nowIso, uuid, num, str, isDate, isUuid, snum, isEmail, all, one, run,
  hashPin, pinMatches, hashPassword, passwordMatches, throttled, failHit, failClear, newSession, bearer, loadSession,
  ROLES, roleAllows, READ_FNS, TRIAL_DAYS, TIERS, today, addMonths, isExpired, billingOf, randCode, sameStr, sha256hex,
} from "../../lib/core";
import { hostOf, siteOf, slugOk, isSlug } from "../../lib/host";

const MONEY_KEYS = ["schet", "eur", "usd", "mdl"];
const TAGS = ["booking", "airbnb", "closed"];

const xlsx = (buf: ArrayBuffer | Uint8Array, name: string) => new Response(buf as any, { headers: {
  "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`, "cache-control": "no-store" } });

function guideToken() { return randCode(10); }
async function getConfig(db: D1Database, O: string) { const c = await one(db, "SELECT data FROM app_config WHERE org_id = ?", O); return c ? JSON.parse(c.data) : null; }

// a fresh company starts with one apartment and the owner as the only manager
function starterConfig(ownerName: string) {
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
  const bks = await all(db, "SELECT id, apt, date, nights FROM bookings WHERE org_id = ? AND nights > 0 AND date >= ? AND date <= ?", O, addDays(from, -400), to);
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
  const notifs = await all(db, "SELECT id, at, title, body FROM notifs WHERE org_id = ? AND target IN ('staff', ?) ORDER BY id DESC LIMIT 30", O, "staff:" + me.id);
  return { me: { id: me.id, name: me.name }, apts: cfg.apts || [], addr, days, repairs, notifs };
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
async function notify(db: D1Database, O: string, who: string[], msg: { title: string; body?: string; tag?: string }) {
  for (const w of who) await run(db, "INSERT INTO notifs(org_id, target, title, body) VALUES (?,?,?,?)", O, w, msg.title, msg.body || "").catch(() => {});
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
  };
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params, waitUntil }) => {
  if (request.method !== "POST") return json({ message: "method_not_allowed" }, 405);
  const fn = String(([] as string[]).concat((params as any).path || []).pop() || "");
  let body: any = {};
  try { body = await request.json(); } catch { return json({ message: "bad_json" }, 400); }
  const db = env.DB;
  // which company this request is for: the subdomain (rentwill.espace.md), or on test hosts the x-espace-org header
  const site = siteOf(hostOf(request));
  const reqSlug = site.kind === "tenant" ? site.slug : site.kind === "dev" ? str(request.headers.get("x-espace-org"), 40).toLowerCase() : "";

  // ---------- public: the marketing site and the company login screen ----------
  if (fn === "org_public") {
    const o = isSlug(str(body.slug, 40)) ? await one(db, "SELECT name, code FROM orgs WHERE code = ?", str(body.slug, 40)) : null;
    return o ? json({ name: o.name, slug: o.code }) : json({ message: "not_found" }, 404);
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
    return json(true);
  }

  // ---------- platform cron: reminders and morning summaries for every active company ----------
  if (fn === "cron") {
    if (!env.CRON_KEY || !sameStr(await sha256hex(str(body.key, 200)), await sha256hex(env.CRON_KEY))) { await sleep(1000); return json({ message: "bad_key" }, 401); }
    let n = 0;
    for (const org of await all(db, "SELECT * FROM orgs WHERE status = 'active'")) if (!isExpired(org)) { await runDue(db, org).catch(() => {}); n++; }
    return json({ orgs: n });
  }

  // ---------- sign up / sign in ----------
  if (fn === "auth_register") {
    const orgName = str(body.org_name, 80), name = str(body.name, 60), email = str(body.email, 120).toLowerCase(), pw = typeof body.password === "string" ? body.password : "";
    if (!orgName || !name) return json({ message: "need_names" }, 400);
    if (!isEmail(email)) return json({ message: "bad_email" }, 400);
    if (pw.length < 8 || pw.length > 128) return json({ message: "pw_too_short" }, 400);
    const slug = str(body.slug, 40).toLowerCase();
    if (!slugOk(slug)) return json({ message: "bad_slug" }, 400);
    if (!(await slugFree(db, slug))) return json({ message: "slug_taken" }, 409);
    if (await one(db, "SELECT 1 AS x FROM users WHERE email = ?", email)) { await sleep(500); return json({ message: "email_taken" }, 409); }
    const uid = uuid(), oid = uuid();
    await db.batch([
      db.prepare("INSERT INTO users(id, email, name, pw_hash) VALUES (?,?,?,?)").bind(uid, email, name, await hashPassword(pw)),
      db.prepare("INSERT INTO orgs(id, name, code, trial_ends) VALUES (?,?,?,?)").bind(oid, orgName, slug, addDays(today(), TRIAL_DAYS)),
      db.prepare("INSERT INTO members(org_id, user_id, role) VALUES (?,?, 'owner')").bind(oid, uid),
      db.prepare("INSERT INTO app_config(org_id, data) VALUES (?,?)").bind(oid, JSON.stringify(starterConfig(name))),
    ]);
    const token = await newSession(db, uid, oid);
    const c = await loadSession(db, env, token);
    return json({ token, me: await meOf(db, c!) });
  }
  if (fn === "auth_login") {
    const email = str(body.email, 120).toLowerCase(), pw = typeof body.password === "string" ? body.password : "";
    const k = "em:" + email;
    if (await throttled(db, k)) return json({ message: "locked" }, 429);
    const u = await one(db, "SELECT * FROM users WHERE email = ?", email);
    if (!u || !(await passwordMatches(pw, u.pw_hash))) { await failHit(db, k); await sleep(1000); return json({ message: "bad_login" }, 401); }
    await failClear(db, k);
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
    if (fn !== "cl_login" && fn !== "cl_load" && isExpired(org)) return json({ message: "subscription_expired" }, 402);
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
    if (!c.isSuper) { await sleep(500); return json({ message: "forbidden" }, 403); }
    if (fn === "sa_orgs") {
      const orgs = await all(db, `SELECT o.*, (SELECT COUNT(*) FROM members m WHERE m.org_id = o.id) AS members,
        (SELECT u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.org_id = o.id AND m.role = 'owner' ORDER BY m.created_at LIMIT 1) AS owner_email,
        (SELECT u.name FROM members m JOIN users u ON u.id = m.user_id WHERE m.org_id = o.id AND m.role = 'owner' ORDER BY m.created_at LIMIT 1) AS owner_name,
        (SELECT COUNT(*) FROM bookings b WHERE b.org_id = o.id) AS bookings,
        (SELECT MAX(updated_at) FROM bookings b WHERE b.org_id = o.id) AS last_activity
        FROM orgs o ORDER BY o.created_at DESC`);
      const out: any[] = [];
      for (const o of orgs) out.push({ ...o, billing: await billingOf(db, o) });
      const payments = await all(db, "SELECT * FROM payments ORDER BY created_at DESC LIMIT 200");
      const leads = await all(db, "SELECT * FROM leads ORDER BY created_at DESC LIMIT 200");
      return json({ orgs: out, payments, leads, tiers: TIERS });
    }
    if (fn === "sa_lead") {
      await run(db, "UPDATE leads SET status = ? WHERE id = ?", body.status === "done" ? "done" : "new", str(body.id, 40));
      return json(true);
    }
    const org = await one(db, "SELECT * FROM orgs WHERE id = ?", str(body.org_id, 40));
    if (!org) return json({ message: "not_found" }, 404);
    if (fn === "sa_pay") { // record a payment: extends paid_until by N months from the later of today / current end
      const months = Math.max(1, Math.min(24, Math.floor(num(body.months)) || 1)), amount = num(body.amount), note = str(body.note, 300);
      const base = [today(), org.paid_until || "", org.trial_ends || ""].sort().pop()!;
      const until = addMonths(base, months);
      await db.batch([
        db.prepare("UPDATE orgs SET paid_until = ?, status = 'active' WHERE id = ?").bind(until, org.id),
        db.prepare("INSERT INTO payments(id, org_id, amount, months, paid_until, note) VALUES (?,?,?,?,?,?)").bind(uuid(), org.id, amount, months, until, note),
      ]);
      return json({ paid_until: until });
    }
    if (fn === "sa_status") { // block / unblock
      const st = body.status === "blocked" ? "blocked" : "active";
      await run(db, "UPDATE orgs SET status = ? WHERE id = ?", st, org.id);
      return json(st);
    }
    if (fn === "sa_trial") { // set the trial end date by hand
      if (!isDate(body.trial_ends)) return json({ message: "bad_date" }, 400);
      await run(db, "UPDATE orgs SET trial_ends = ? WHERE id = ?", body.trial_ends, org.id);
      return json(body.trial_ends);
    }
    if (fn === "sa_slug") { // change a company's address (old links stop working)
      const slug = str(body.slug, 40).toLowerCase();
      if (slug === org.code) return json(slug);
      if (!slugOk(slug)) return json({ message: "bad_slug" }, 400);
      if (!(await slugFree(db, slug))) return json({ message: "slug_taken" }, 409);
      await run(db, "UPDATE orgs SET code = ? WHERE id = ?", slug, org.id);
      return json(slug);
    }
    if (fn === "sa_note") { await run(db, "UPDATE orgs SET note = ? WHERE id = ?", str(body.note, 1000), org.id); return json(true); }
    return json({ message: "not_found" }, 404);
  }

  // ---------- company workspace ----------
  if (!c.org) return json({ message: "no_org" }, 409);
  const O = c.org.id, org = c.org;
  if (!roleAllows(c.role, fn)) return json({ message: "read_only" }, 403);
  // unpaid or blocked: the data stays visible, nothing can be changed
  if (isExpired(org) && !READ_FNS.includes(fn) && !fn.startsWith("team_")) return json({ message: "subscription_expired" }, 402);

  if (fn === "billing") {
    return json({ ...(await billingOf(db, org)), tiers: TIERS, payments: await all(db, "SELECT amount, months, paid_until, note, created_at FROM payments WHERE org_id = ? ORDER BY created_at DESC", O) });
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
  if (fn === "team_add") { // adds a person with a starting password; an existing account is only given access
    const email = str(body.email, 120).toLowerCase(), name = str(body.name, 60), role = ROLES.includes(body.role) && body.role !== "owner" ? body.role : "manager";
    if (!isEmail(email)) return json({ message: "bad_email" }, 400);
    let u = await one(db, "SELECT id FROM users WHERE email = ?", email);
    if (!u) {
      const pw = typeof body.password === "string" ? body.password : "";
      if (pw.length < 8 || pw.length > 128) return json({ message: "pw_too_short" }, 400);
      if (!name) return json({ message: "need_names" }, 400);
      u = { id: uuid() };
      await run(db, "INSERT INTO users(id, email, name, pw_hash) VALUES (?,?,?,?)", u.id, email, name, await hashPassword(pw));
    }
    await run(db, "INSERT INTO members(org_id, user_id, role) VALUES (?,?,?) ON CONFLICT (org_id, user_id) DO UPDATE SET role = excluded.role", O, u.id, role);
    return json(u.id);
  }
  if (fn === "team_role" || fn === "team_remove") {
    const uid = str(body.user_id, 40);
    if (uid === c.user.id) return json({ message: "not_self" }, 400);
    const m = await one(db, "SELECT role FROM members WHERE org_id = ? AND user_id = ?", O, uid);
    if (!m) return json({ message: "not_found" }, 404);
    if (fn === "team_remove") {
      await run(db, "DELETE FROM members WHERE org_id = ? AND user_id = ?", O, uid);
      await run(db, "DELETE FROM sessions WHERE user_id = ? AND org_id = ?", uid, O);
      return json(true);
    }
    const role = ROLES.includes(body.role) ? body.role : "manager";
    await run(db, "UPDATE members SET role = ? WHERE org_id = ? AND user_id = ?", role, O, uid);
    return json(role);
  }

  switch (fn) {
    case "kv_load":
      return json(await loadAll(db, O));

    case "kv_save": {
      const b = body.b || {};
      if (!isDate(b.date) || !str(b.apt)) return json({ message: "bad_booking" }, 400);
      { const old = isUuid(b.id) ? await one(db, "SELECT date FROM bookings WHERE org_id = ? AND id = ?", O, b.id) : null; if (await monthClosed(db, O, b.date, old?.date)) return CLOSED(); }
      const v = { date: b.date, apt: str(b.apt, 100), guest: str(b.guest, 200), nights: Math.min(366, Math.floor(num(b.nights))),
        mdl: num(b.mdl), eur: num(b.eur), usd: num(b.usd), pay: str(b.pay, 50), who: str(b.who, 50), note: str(b.note, 1000),
        source: str(b.source, 50), phone: str(b.phone, 40), oth: num(b.oth), oth_cur: str(b.oth_cur, 10).toUpperCase(), util: num(b.util),
        price: Math.max(0, num(b.price)), price_cur: (["MDL", "EUR", "USD"].includes(str(b.price_cur, 5).toUpperCase()) ? str(b.price_cur, 5).toUpperCase() : "EUR"), pay_status: (["unpaid", "part", "paid"].includes(str(b.pay_status, 10)) ? str(b.pay_status, 10) : ""), tag: (TAGS.includes(str(b.tag, 10)) ? str(b.tag, 10) : ""),
        util_cur: (["MDL", "EUR", "USD"].includes(str(b.util_cur, 5).toUpperCase()) ? str(b.util_cur, 5).toUpperCase() : "MDL") };
      if (isUuid(b.id)) {
        const r = await one(db, `UPDATE bookings SET verified=(verified AND mdl=? AND eur=? AND usd=? AND oth IS ? AND util=? AND pay=?),
          date=?, apt=?, guest=?, nights=?, mdl=?, eur=?, usd=?, pay=?, who=?, note=?, source=?, phone=?, oth=?, oth_cur=?, util=?, util_cur=?, price=?, price_cur=?, pay_status=?, tag=?, updated_at=? WHERE org_id=? AND id=? RETURNING id`,
          v.mdl, v.eur, v.usd, v.oth, v.util, v.pay,
          v.date, v.apt, v.guest, v.nights, v.mdl, v.eur, v.usd, v.pay, v.who, v.note, v.source, v.phone, v.oth, v.oth_cur, v.util, v.util_cur, v.price, v.price_cur, v.pay_status, v.tag, nowIso(), O, b.id);
        return json(r?.id ?? null);
      }
      const id = uuid(), t = nowIso();
      await run(db, "INSERT INTO bookings(id,org_id,date,apt,guest,nights,mdl,eur,usd,pay,who,note,source,phone,oth,oth_cur,util,util_cur,price,price_cur,pay_status,tag,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id, O, v.date, v.apt, v.guest, v.nights, v.mdl, v.eur, v.usd, v.pay, v.who, v.note, v.source, v.phone, v.oth, v.oth_cur, v.util, v.util_cur, v.price, v.price_cur, v.pay_status, v.tag, t, t);
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
      const RU = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
      waitUntil(notify(db, O, ["manager"], { title: "✅ Месяц закрыт: " + RU[+ym.slice(5) - 1] + " " + ym.slice(0, 4), body: "Все оплаты и смены проверены" + (who ? " — " + who : "") }).catch(() => {}));
      return json(ym);
    }
    case "kv_month_open": {
      const ym = str(body.ym, 7), note = str(body.note, 500);
      if (!note) return json({ message: "need_note" }, 400);
      await run(db, "DELETE FROM month_close WHERE org_id = ? AND ym = ?", O, ym);
      await run(db, "INSERT INTO verify_log(org_id, kind, ref_id, action, who, note, at) VALUES (?,'month',?,?,?,?,?)", O, ym, "open", str(body.who, 50) || c.user.name, note, nowIso()).catch(() => {});
      return json(ym);
    }
    case "kv_delete": {
      if (!isUuid(body.p_id)) return json({ message: "bad_id" }, 400);
      { const old = await one(db, "SELECT date FROM bookings WHERE org_id = ? AND id = ?", O, body.p_id); if (await monthClosed(db, O, old?.date)) return CLOSED(); }
      await run(db, "DELETE FROM bookings WHERE org_id = ? AND id = ?", O, body.p_id);
      return json(null);
    }
    case "kv_save_expense": {
      const e = body.e || {};
      if (!isDate(e.date) || !str(e.category)) return json({ message: "bad_expense" }, 400);
      { const old = isUuid(e.id) ? await one(db, "SELECT date FROM expenses WHERE org_id = ? AND id = ?", O, e.id) : null; if (await monthClosed(db, O, e.date, old?.date)) return CLOSED(); }
      const v = { date: e.date, apt: str(e.apt, 100), category: str(e.category, 60), mdl: num(e.mdl), eur: num(e.eur), usd: num(e.usd),
        who: str(e.who, 50), note: str(e.note, 1000), oth: num(e.oth), oth_cur: str(e.oth_cur, 10).toUpperCase(), yearly: e.yearly === true ? 1 : 0 };
      if (isUuid(e.id)) {
        const r = await one(db, "UPDATE expenses SET date=?, apt=?, category=?, mdl=?, eur=?, usd=?, who=?, note=?, oth=?, oth_cur=?, yearly=?, updated_at=? WHERE org_id=? AND id=? RETURNING id",
          v.date, v.apt, v.category, v.mdl, v.eur, v.usd, v.who, v.note, v.oth, v.oth_cur, v.yearly, nowIso(), O, e.id);
        if (r?.id || !e.new) return json(r?.id ?? null);
      }
      // a client-made id (e.new) is kept only if nobody has it yet
      const id = isUuid(e.id) && e.new && !(await one(db, "SELECT 1 AS x FROM expenses WHERE id = ?", e.id)) ? e.id : uuid(), t = nowIso();
      await run(db, "INSERT INTO expenses(id,org_id,date,apt,category,mdl,eur,usd,who,note,oth,oth_cur,yearly,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id, O, v.date, v.apt, v.category, v.mdl, v.eur, v.usd, v.who, v.note, v.oth, v.oth_cur, v.yearly, t, t);
      return json(id);
    }
    case "kv_delete_expense": {
      if (!isUuid(body.p_id)) return json({ message: "bad_id" }, 400);
      { const old = await one(db, "SELECT date FROM expenses WHERE org_id = ? AND id = ?", O, body.p_id); if (await monthClosed(db, O, old?.date)) return CLOSED(); }
      await run(db, "DELETE FROM expenses WHERE org_id = ? AND id = ?", O, body.p_id);
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
      const s = JSON.stringify(d); if (s.length > 300000) return json({ message: "too_big" }, 400);
      // over 70 apartments the price is individual — the platform owner sets it up by hand
      if (d.apts.length > 70) return json({ message: "too_many_apts" }, 409);
      await run(db, "INSERT INTO app_config(org_id,data) VALUES (?,?) ON CONFLICT (org_id) DO UPDATE SET data = excluded.data", O, s);
      return json(null);
    }
    case "kv_rename_apt": {
      const from = str(body.from, 100), to = str(body.to, 100);
      if (!from || !to || from === to) return json({ message: "bad_name" }, 400);
      const data = await getConfig(db, O);
      if (!data) return json({ message: "bad_config" }, 400);
      if (data.apts.includes(to)) return json({ message: "name_exists" }, 409);
      data.apts = data.apts.map((a: string) => (a === from ? to : a));
      if (data.addr && data.addr[from] != null) { data.addr[to] = data.addr[from]; delete data.addr[from]; }
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
        const bks = await all(db, "SELECT id, apt, date, nights, created_at FROM bookings WHERE org_id = ? AND nights > 0 AND tag != 'closed' AND date >= ? AND date <= ? ORDER BY created_at", O, addDays(date, -400), date);
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
