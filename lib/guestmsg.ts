// Guest messaging: templates + tag fill + cron/manual send via Resend (sendMail).
import { type Env, all, one, run, uuid, str, num, isEmail, today, addDays, nowIso } from "./core";
import { sendMail } from "./mail";

export type MsgTrigger = "new" | "before_in" | "on_in" | "before_out" | "after_out" | "cancel";
export type MsgLang = "ro" | "ru" | "en";

const TRIGGERS: MsgTrigger[] = ["new", "before_in", "on_in", "before_out", "after_out", "cancel"];

export function chisinauHour() {
  const p: any = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Chisinau", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
  return Number(p.hour) || 0;
}

function parseList(raw: string): string[] {
  if (!raw) return [];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a.map((x) => String(x)).filter(Boolean) : []; } catch { return []; }
}
function dumpList(a: unknown) {
  if (!Array.isArray(a)) return "[]";
  return JSON.stringify(a.map((x) => String(x)).slice(0, 100).filter(Boolean).slice(0, 80));
}

/** Anchor dates: before_in = date − offset; on_in = date + offset; before_out = checkout − offset; after_out = checkout + offset. */
export function defaultTemplates(): Array<{
  name: string; trigger: MsgTrigger; offset_days: number; send_hour: number;
  subject_ro: string; subject_ru: string; subject_en: string;
  body_ro: string; body_ru: string; body_en: string;
}> {
  return [
    {
      name: "Confirmare rezervare", trigger: "new", offset_days: 0, send_hour: 10,
      subject_ro: "Rezervare confirmată — {unitate}", subject_ru: "Бронь подтверждена — {unitate}", subject_en: "Booking confirmed — {unitate}",
      body_ro: "Bună, {nume}!\n\nRezervarea ta la {unitate} este confirmată.\nSosire: {sosire}{ora_sosire}\nPlecare: {plecare}\nNopți: {nopti}\nOaspeți: {oaspeti}\n\nAdresa: {adresa}\nGhid: {link_ghid}\n\nTe așteptăm!\n{telefon_firma}",
      body_ru: "Здравствуйте, {nume}!\n\nБронь в {unitate} подтверждена.\nЗаезд: {sosire}{ora_sosire}\nВыезд: {plecare}\nНочей: {nopti}\nГостей: {oaspeti}\n\nАдрес: {adresa}\nГид: {link_ghid}\n\nЖдём вас!\n{telefon_firma}",
      body_en: "Hello {nume},\n\nYour stay at {unitate} is confirmed.\nCheck-in: {sosire}{ora_sosire}\nCheck-out: {plecare}\nNights: {nopti}\nGuests: {oaspeti}\n\nAddress: {adresa}\nGuide: {link_ghid}\n\nSee you soon!\n{telefon_firma}",
    },
    {
      name: "Cu o zi înainte", trigger: "before_in", offset_days: 1, send_hour: 10,
      subject_ro: "Mâine te așteptăm — {unitate}", subject_ru: "Завтра ждём вас — {unitate}", subject_en: "See you tomorrow — {unitate}",
      body_ro: "Bună, {nume}!\n\nMâine ({sosire}) te așteptăm la {unitate}.\nAdresa: {adresa}\nOra sosirii: {ora_sosire}\nCod ușă: {cod_usa}\nHartă: {link_harta}\nGhid: {link_ghid}\n\n{telefon_firma}",
      body_ru: "Здравствуйте, {nume}!\n\nЗавтра ({sosire}) ждём вас в {unitate}.\nАдрес: {adresa}\nВремя заезда: {ora_sosire}\nКод двери: {cod_usa}\nКарта: {link_harta}\nГид: {link_ghid}\n\n{telefon_firma}",
      body_en: "Hello {nume},\n\nTomorrow ({sosire}) we expect you at {unitate}.\nAddress: {adresa}\nArrival time: {ora_sosire}\nDoor code: {cod_usa}\nMap: {link_harta}\nGuide: {link_ghid}\n\n{telefon_firma}",
    },
    {
      name: "A doua zi după sosire", trigger: "on_in", offset_days: 1, send_hour: 11,
      subject_ro: "Sperăm că e totul bine — {unitate}", subject_ru: "Надеемся, всё хорошо — {unitate}", subject_en: "Hope everything is fine — {unitate}",
      body_ro: "Bună, {nume}!\n\nSperăm că te simți bine la {unitate}. Dacă ai nevoie de ceva — scrie-ne.\n{telefon_firma}",
      body_ru: "Здравствуйте, {nume}!\n\nНадеемся, вам комфортно в {unitate}. Если что-то нужно — напишите.\n{telefon_firma}",
      body_en: "Hello {nume},\n\nWe hope you are comfortable at {unitate}. Need anything? Just message us.\n{telefon_firma}",
    },
    {
      name: "Informații de plecare", trigger: "before_out", offset_days: 0, send_hour: 9,
      subject_ro: "Plecarea de azi — {unitate}", subject_ru: "Выезд сегодня — {unitate}", subject_en: "Check-out today — {unitate}",
      body_ro: "Bună, {nume}!\n\nAzi e ziua plecării din {unitate} (până la {ora_plecare}).\nTe rugăm să lași cheile / să închizi ușa.\nMulțumim!\n{telefon_firma}",
      body_ru: "Здравствуйте, {nume}!\n\nСегодня выезд из {unitate} (до {ora_plecare}).\nПожалуйста, оставьте ключи / закройте дверь.\nСпасибо!\n{telefon_firma}",
      body_en: "Hello {nume},\n\nToday is check-out from {unitate} (by {ora_plecare}).\nPlease leave the keys / lock the door.\nThank you!\n{telefon_firma}",
    },
    {
      name: "Cerere de recenzie", trigger: "after_out", offset_days: 1, send_hour: 11,
      subject_ro: "Cum a fost sejurul? — {unitate}", subject_ru: "Как прошёл визит? — {unitate}", subject_en: "How was your stay? — {unitate}",
      body_ro: "Bună, {nume}!\n\nMulțumim că ai stat la {unitate}. Dacă ai un minut, o scurtă recenzie ne ajută foarte mult.\n{telefon_firma}",
      body_ru: "Здравствуйте, {nume}!\n\nСпасибо, что останавливались в {unitate}. Короткая оценка очень поможет нам.\n{telefon_firma}",
      body_en: "Hello {nume},\n\nThank you for staying at {unitate}. A short review would help us a lot.\n{telefon_firma}",
    },
  ];
}

export async function seedTemplates(db: D1Database, orgId: string) {
  const n = await one(db, "SELECT COUNT(*) AS n FROM msg_templates WHERE org_id = ?", orgId);
  if (n && n.n > 0) return 0;
  let c = 0;
  for (const t of defaultTemplates()) {
    await run(db, `INSERT INTO msg_templates(id,org_id,name,trigger,offset_days,send_hour,apts,channels,subject_ro,subject_ru,subject_en,body_ro,body_ru,body_en,active,created_at,updated_at)
      VALUES (?,?,?,?,?,?,'[]','[]',?,?,?,?,?,?,1,?,?)`,
      uuid(), orgId, t.name, t.trigger, t.offset_days, t.send_hour,
      t.subject_ro, t.subject_ru, t.subject_en, t.body_ro, t.body_ru, t.body_en, nowIso(), nowIso());
    c++;
  }
  return c;
}

export function pickLang(extra: any, fallback: MsgLang = "ro"): MsgLang {
  const l = String(extra?.lang || "").toLowerCase();
  if (l === "ru" || l === "en" || l === "ro") return l;
  if (l === "uk") return "ru";
  return fallback;
}

function dmy(d: string) {
  return d && d.length >= 10 ? d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(0, 4) : "";
}

export function fillTags(text: string, vars: Record<string, string>) {
  return String(text || "").replace(/\{([a-z_]+)\}/gi, (_, k) => (vars[k] != null ? vars[k] : ""));
}

export async function bookingVars(db: D1Database, org: any, booking: any, cfg: any): Promise<Record<string, string>> {
  let extra: any = {}; try { extra = JSON.parse(booking.extra || "{}"); } catch {}
  const apt = booking.apt || "";
  const unit = (cfg.units || {})[apt] || {};
  const addr = (cfg.addr || {})[apt] || "";
  const nights = Number(booking.nights) || 0;
  const out = nights > 0 ? addDays(booking.date, nights) : booking.date;
  const g = await one(db, "SELECT token FROM guides WHERE org_id = ? AND apt = ?", org.id, apt).catch(() => null);
  const k = await one(db, "SELECT token FROM contracts WHERE org_id = ? AND booking_id = ? ORDER BY created_at DESC LIMIT 1", org.id, booking.id).catch(() => null);
  const mapQ = addr ? addr + ", Chișinău" : apt + ", Chișinău";
  const total = Number(booking.price) || 0;
  const got = (Number(booking.mdl) || 0) + (Number(booking.eur) || 0) + (Number(booking.usd) || 0) + (Number(booking.oth) || 0);
  const rest = Math.max(0, Math.round((total - got) * 100) / 100);
  const tin = extra.tin ? " " + extra.tin : "";
  const tout = extra.tout || unit.cout || "11:00";
  return {
    nume: booking.guest || "",
    unitate: apt,
    adresa: addr,
    sosire: dmy(booking.date),
    plecare: dmy(out),
    ora_sosire: tin ? tin.trim() : (unit.cin || ""),
    ora_plecare: tout,
    nopti: String(nights),
    oaspeti: String(booking.pax || ""),
    total: total ? String(total) + " " + (booking.price_cur || "") : "",
    rest: rest ? String(rest) + " " + (booking.price_cur || "") : "",
    avans: got ? String(Math.round(got * 100) / 100) : "",
    link_ghid: g?.token ? `https://espace.md/g/${g.token}` : "",
    link_contract: k?.token ? `https://${org.code}.espace.md/contract/${k.token}` : "",
    link_checkin: "",
    link_plata: "",
    link_harta: addr ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(mapQ) : "",
    cod_usa: unit.door || unit.code || "",
    telefon_firma: (cfg.direct && cfg.direct.phone) || "",
    nota_echipa: extra.team || "",
  };
}

function matchesFilters(tpl: any, booking: any) {
  const apts = parseList(tpl.apts), ch = parseList(tpl.channels);
  if (apts.length && !apts.includes(booking.apt)) return false;
  if (ch.length && booking.source && !ch.includes(booking.source)) return false;
  if (ch.length && !booking.source) return false;
  return true;
}

function dueToday(booking: any, tpl: any, t: string): boolean {
  const tr = tpl.trigger as MsgTrigger;
  const off = Number(tpl.offset_days) || 0;
  if (tr === "before_in") return t === addDays(booking.date, -off);
  if (tr === "on_in") return t === addDays(booking.date, off);
  if (tr === "before_out") {
    const out = Number(booking.nights) > 0 ? addDays(booking.date, Number(booking.nights)) : "";
    return !!out && t === addDays(out, -off);
  }
  if (tr === "after_out") {
    const out = Number(booking.nights) > 0 ? addDays(booking.date, Number(booking.nights)) : "";
    return !!out && t === addDays(out, off);
  }
  return false;
}

function textFor(tpl: any, lang: MsgLang) {
  const sub = tpl["subject_" + lang] || tpl.subject_ro || tpl.subject_ru || tpl.subject_en || "";
  const body = tpl["body_" + lang] || tpl.body_ro || tpl.body_ru || tpl.body_en || "";
  return { subject: sub, body };
}

function toHtml(body: string) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#14162e;line-height:1.55;font-size:15px">
<div style="max-width:560px;margin:0 auto;padding:20px">${esc(body).replace(/\n/g, "<br>")}</div></body></html>`;
}

async function recordSent(db: D1Database, row: {
  orgId: string; bookingId: string; templateId: string; to: string; lang: string;
  subject: string; body: string; status: string; detail?: string;
}) {
  await run(db, `INSERT INTO msg_sent(id,org_id,booking_id,template_id,channel,to_addr,lang,subject,body,status,detail,created_at)
    VALUES (?,?,?,?,'email',?,?,?,?,?,?,?)`,
    uuid(), row.orgId, row.bookingId, row.templateId || "", row.to, row.lang, row.subject.slice(0, 200), row.body.slice(0, 8000), row.status, row.detail || "", nowIso()).catch(() => {});
}

export async function sendGuestMessage(env: Env, db: D1Database, org: any, booking: any, tpl: any, opts: { previewBody?: string; previewSubject?: string; forceLang?: MsgLang; manual?: boolean } = {}) {
  const to = str(booking.email, 120).toLowerCase();
  if (!isEmail(to)) return { ok: false, message: "no_email" };
  let cfg: any = {};
  const c = await one(db, "SELECT data FROM app_config WHERE org_id = ?", org.id);
  try { cfg = JSON.parse(c?.data || "{}"); } catch {}
  let extra: any = {}; try { extra = JSON.parse(booking.extra || "{}"); } catch {}
  const lang = opts.forceLang || pickLang(extra);
  const vars = await bookingVars(db, org, booking, cfg);
  const raw = textFor(tpl, lang);
  const subject = fillTags(opts.previewSubject != null ? opts.previewSubject : raw.subject, vars).slice(0, 200);
  const body = fillTags(opts.previewBody != null ? opts.previewBody : raw.body, vars);
  if (!subject || !body) return { ok: false, message: "empty" };
  const key = opts.manual ? undefined : `guestmsg:${tpl.id || "x"}:${booking.id}:${tpl.trigger || "m"}:${tpl.offset_days ?? 0}`;
  const status = await sendMail(env, db, { to, subject, html: toHtml(body), kind: "guest_msg", orgId: org.id, key });
  await recordSent(db, { orgId: org.id, bookingId: booking.id, templateId: tpl.id || "", to, lang, subject, body, status: String(status) });
  return { ok: true, status, subject };
}

/** Cron: scheduled templates for today at the current Chișinău hour. */
export async function runGuestMails(env: Env, db: D1Database) {
  const t = today(), hour = chisinauHour();
  let n = 0;
  const orgs = await all(db, "SELECT * FROM orgs WHERE status = 'active'");
  for (const org of orgs) {
    const tpls = await all(db, "SELECT * FROM msg_templates WHERE org_id = ? AND active = 1 AND trigger IN ('before_in','on_in','before_out','after_out') AND send_hour = ?", org.id, hour);
    if (!tpls.length) continue;
    const books = await all(db, `SELECT * FROM bookings WHERE org_id = ? AND nights > 0 AND email != '' AND tag NOT IN ('closed','req')
      AND date >= ? AND date <= ?`, org.id, addDays(t, -400), addDays(t, 400));
    for (const tpl of tpls) {
      for (const b of books) {
        if (b.tag === "cancel" && tpl.trigger !== "cancel") continue;
        if (!matchesFilters(tpl, b)) continue;
        if (!dueToday(b, tpl, t)) continue;
        const r = await sendGuestMessage(env, db, org, b, tpl);
        if (r.ok && r.status !== "duplicate") n++;
      }
    }
  }
  return n;
}

/** Immediate: new booking or cancel. */
export async function fireEventMessages(env: Env, db: D1Database, org: any, booking: any, trigger: "new" | "cancel") {
  if (!booking?.email || !isEmail(booking.email)) return 0;
  const tpls = await all(db, "SELECT * FROM msg_templates WHERE org_id = ? AND active = 1 AND trigger = ?", org.id, trigger);
  let n = 0;
  for (const tpl of tpls) {
    if (!matchesFilters(tpl, booking)) continue;
    const r = await sendGuestMessage(env, db, org, booking, tpl);
    if (r.ok && r.status !== "duplicate") n++;
  }
  return n;
}

export function sanitizeTemplate(body: any) {
  const trigger = TRIGGERS.includes(body.trigger) ? body.trigger : "new";
  return {
    id: typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : "",
    name: str(body.name, 80) || "Șablon",
    trigger,
    offset_days: Math.max(0, Math.min(60, Math.floor(num(body.offset_days)))),
    send_hour: Math.max(0, Math.min(23, Math.floor(num(body.send_hour)))),
    apts: dumpList(body.apts),
    channels: dumpList(body.channels),
    subject_ro: str(body.subject_ro, 200), subject_ru: str(body.subject_ru, 200), subject_en: str(body.subject_en, 200),
    body_ro: str(body.body_ro, 5000), body_ru: str(body.body_ru, 5000), body_en: str(body.body_en, 5000),
    active: body.active === false ? 0 : 1,
  };
}

export { parseList, TRIGGERS };
