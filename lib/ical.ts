// Calendar sync with Airbnb, Booking.com and others through iCal links.
// Import: each unit can have feeds (the platform's "export calendar" link); every ~15 minutes the reservations in them
// become bookings here (source Airbnb/Booking), moved when they move, removed when cancelled.
// Export: each unit has a link (/ical/<company>/<key>.ics) to paste into Airbnb/Booking so dates taken here are blocked there.
import { all, one, run, uuid, today, addDays, nowIso, randHex } from "./core";

export interface IcsEvent { uid: string; start: string; end: string; summary: string; desc: string }

const ymd = (v: string) => { const m = /(\d{4})(\d{2})(\d{2})/.exec(v || ""); return m ? `${m[1]}-${m[2]}-${m[3]}` : ""; };
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
const unescape = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

export function parseIcs(text: string): IcsEvent[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n"); // unfold long lines
  const out: IcsEvent[] = []; let ev: any = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { ev = {}; continue; }
    if (line === "END:VEVENT") { if (ev && ev.start) out.push({ uid: ev.uid || `${ev.start}-${ev.end}`, start: ev.start, end: ev.end || addDays(ev.start, 1), summary: ev.summary || "", desc: ev.desc || "" }); ev = null; continue; }
    if (!ev) continue;
    const i = line.indexOf(":"); if (i < 0) continue;
    const key = line.slice(0, i).split(";")[0].toUpperCase(), val = line.slice(i + 1);
    if (key === "UID") ev.uid = val.trim();
    else if (key === "DTSTART") ev.start = ymd(val);
    else if (key === "DTEND") ev.end = ymd(val);
    else if (key === "SUMMARY") ev.summary = unescape(val).trim();
    else if (key === "DESCRIPTION") ev.desc = unescape(val).trim();
  }
  return out.filter((e) => e.start && e.end && e.end > e.start);
}

// what an event means: a guest's reservation, or dates the host closed on the platform
export function classify(e: IcsEvent, source: string) {
  const s = e.summary.toLowerCase();
  const closed = source === "Airbnb" ? /not available|blocked/.test(s) : /^blocked|^closed - blocked/.test(s);
  let guest = "";
  if (!closed) {
    if (source === "Airbnb") guest = "Airbnb";
    else if (source === "Booking") guest = "Booking.com";
    else guest = e.summary.slice(0, 80) || source || "iCal";
  }
  const phone = /Phone Number \(Last 4 Digits\):\s*(\d{4})/i.exec(e.desc)?.[1];
  const link = /(https:\/\/www\.airbnb\.[a-z.]+\/hosting\/reservations\/details\/[A-Z0-9]+)/i.exec(e.desc)?.[1];
  return { closed, guest, note: [phone ? "tel. …" + phone : "", link || ""].filter(Boolean).join(" · ") };
}

export function sourceOf(url: string) {
  const h = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
  return /airbnb\./.test(h) ? "Airbnb" : /booking\.com$/.test(h) ? "Booking" : /vrbo|homeaway/.test(h) ? "Vrbo" : /google\./.test(h) ? "Google" : "iCal";
}

export function feedUrlOk(url: string, allowLocal = false) {
  try {
    const u = new URL(url.replace(/^webcal:/i, "https:"));
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    if (allowLocal && /^(localhost|127\.0\.0\.1)$/.test(u.hostname)) return u.toString(); // local dev server tests only
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname) || u.hostname.endsWith(".local") || u.hostname.endsWith("espace.md")) return "";
    return u.toString();
  } catch { return ""; }
}

async function fetchIcs(url: string) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "espace.md calendar sync", accept: "text/calendar,*/*" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const text = (await r.text()).slice(0, 3_000_000);
    if (!/BEGIN:VCALENDAR/.test(text)) throw new Error("not_ical");
    return text;
  } finally { clearTimeout(t); }
}

type Notify = (O: string, msg: { title: string; body?: string }) => Promise<void>;

// one feed: add new reservations, move changed ones, remove cancelled future ones (never touching money already recorded)
export async function syncFeed(db: D1Database, feed: any, notify?: Notify) {
  const O = feed.org_id, t = today();
  let added = 0, moved = 0, removed = 0;
  try {
    const cfgRow = await one(db, "SELECT data FROM app_config WHERE org_id = ?", O);
    const cfg = cfgRow ? JSON.parse(cfgRow.data) : {};
    if (!(cfg.apts || []).includes(feed.apt)) throw new Error("unit_gone");
    const events = parseIcs(await fetchIcs(feed.url)).filter((e) => e.end > t); // only what isn't over yet
    const mine = await all(db, "SELECT * FROM bookings WHERE org_id = ? AND ext_feed = ?", O, feed.id);
    const byUid: Record<string, any> = Object.fromEntries(mine.map((b: any) => [b.ext_uid, b]));
    const seen = new Set<string>(), news: string[] = [];
    for (const e of events) {
      const uid = e.uid.slice(0, 200); seen.add(uid);
      const nights = Math.min(366, dayDiff(e.start, e.end)), c = classify(e, feed.source);
      const old = byUid[uid];
      if (old) {
        if (old.date !== e.start || old.nights !== nights) {
          await run(db, "UPDATE bookings SET date = ?, nights = ?, updated_at = ? WHERE org_id = ? AND id = ?", e.start, nights, nowIso(), O, old.id);
          moved++; news.push(`${feed.apt}: ${e.start} · ${nights} n. (mutat)`);
        }
        continue;
      }
      // the manager may have entered it by hand already: link instead of duplicating
      const hand = await one(db, "SELECT id FROM bookings WHERE org_id = ? AND apt = ? AND date = ? AND nights = ? AND ext_uid = '' LIMIT 1", O, feed.apt, e.start, nights);
      if (hand) { await run(db, "UPDATE bookings SET ext_uid = ?, ext_feed = ?, source = CASE WHEN source = '' THEN ? ELSE source END WHERE id = ?", uid, feed.id, feed.source === "iCal" ? "" : feed.source, hand.id); continue; }
      const id = uuid(), now = nowIso();
      await run(db, `INSERT INTO bookings(id, org_id, date, apt, guest, nights, source, tag, note, ext_uid, ext_feed, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, O, e.start, feed.apt, c.guest, nights, feed.source === "iCal" ? "" : feed.source, c.closed ? "closed" : "", c.note, uid, feed.id, now, now);
      added++;
      if (!c.closed) news.push(`${feed.apt}: ${e.start} · ${nights} n.`);
    }
    // gone from the feed = cancelled there; only future ones, and only if no money was recorded on them
    for (const b of mine) {
      if (seen.has(b.ext_uid) || addDays(b.date, b.nights) <= t) continue;
      const money = (b.mdl || 0) + (b.eur || 0) + (b.usd || 0) + (b.oth || 0) > 0 || b.verified;
      if (money) await run(db, "UPDATE bookings SET ext_uid = '', ext_feed = '', note = TRIM(note || ' · anulată în ' || ?) WHERE id = ?", feed.source, b.id);
      else await run(db, "DELETE FROM bookings WHERE id = ?", b.id);
      removed++; news.push(`${feed.apt}: ${b.date} (anulat)`);
    }
    await run(db, "UPDATE ical_feeds SET last_sync = ?, last_ok = 1, last_msg = ?, last_count = ? WHERE id = ?", nowIso(), `+${added} ~${moved} -${removed}`, events.length, feed.id);
    if (notify && news.length && feed.last_sync) await notify(O, { title: `${feed.source}: ${news.length === 1 ? news[0] : news.length + " schimbări"}`, body: news.slice(0, 6).join("\n") });
    return { ok: true, added, moved, removed, events: events.length };
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 120);
    await run(db, "UPDATE ical_feeds SET last_sync = ?, last_ok = 0, last_msg = ? WHERE id = ?", nowIso(), msg, feed.id);
    return { ok: false, error: msg, added, moved, removed };
  }
}

// cron (every 5 min): the feeds not synced in the last ~15 minutes, a dozen at a time (the platform limits time per request)
export async function syncDue(db: D1Database, notify?: Notify, limit = 12) {
  const since = new Date(Date.now() - 14 * 60000).toISOString();
  const feeds = await all(db, `SELECT f.* FROM ical_feeds f JOIN orgs o ON o.id = f.org_id WHERE o.status = 'active' AND (f.last_sync = '' OR f.last_sync < ?) ORDER BY f.last_sync LIMIT ?`, since, limit);
  let n = 0; for (const f of feeds) { await syncFeed(db, f, notify); n++; }
  return n;
}

// export: what is taken in this unit, as an iCal calendar (no guest names — the link is not secret enough for that)
export function buildIcs(company: string, apt: string, bookings: any[]) {
  const d = (s: string) => s.replace(/-/g, "");
  const stamp = nowIso().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//espace.md//calendar//RO", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(company + " · " + apt)}`];
  for (const b of bookings) {
    if (!(b.nights > 0)) continue;
    lines.push("BEGIN:VEVENT", `UID:${b.id}@espace.md`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d(b.date)}`, `DTEND;VALUE=DATE:${d(addDays(b.date, b.nights))}`,
      `SUMMARY:${b.tag === "closed" ? "Blocked" : "Reserved"}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export const newIcalKey = () => randHex(10);
