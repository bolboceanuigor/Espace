// /ical/<company>/<key>.ics — a unit's taken dates, to paste into Airbnb / Booking.com ("import calendar"),
// or the company's key (cfg.ical) with every unit for Google Calendar.
import { buildIcs } from "../../lib/ical";
import { addDays, today } from "../../lib/core";

interface Env { DB: D1Database }
export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const parts = ([] as string[]).concat(params.path as any || []);
  const code = String(parts[0] || "").toLowerCase(), key = String(parts[1] || "").replace(/\.ics$/i, "");
  const nf = () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  if (!/^[a-z0-9-]{3,40}$/.test(code) || !/^[0-9a-f]{20}$/.test(key)) return nf();
  const org: any = await env.DB.prepare("SELECT id, name FROM orgs WHERE code = ?").bind(code).first();
  if (!org) return nf();
  const c: any = await env.DB.prepare("SELECT data FROM app_config WHERE org_id = ?").bind(org.id).first();
  let cfg: any = {}; try { cfg = JSON.parse(c?.data || "{}"); } catch {}
  const from = addDays(today(), -30);
  const apts: string[] = cfg.apts || [];
  const unitApt = apts.find((a: string) => (cfg.units || {})[a]?.ical === key);
  const orgAll = !unitApt && cfg.ical === key;
  if (!unitApt && !orgAll) return nf();

  const list: any[] = [];
  const targets = unitApt ? [unitApt] : apts;
  const U = cfg.units || {};
  // coliving: a unit's own export also carries the stays of the apartment it belongs to, or of its rooms
  const linked = (a: string) => { const o: string[] = []; if (U[a]?.parent && U[a].parent !== a) o.push(U[a].parent); for (const k of Object.keys(U)) if (k !== a && U[k]?.parent === a) o.push(k); return o; };
  for (const apt of targets) {
    const src = unitApt ? [apt, ...linked(apt)] : [apt];
    const ph = src.map(() => "?").join(",");
    const rows = await env.DB.prepare(`SELECT id, date, nights, tag, apt, pax FROM bookings WHERE org_id = ? AND apt IN (${ph}) AND nights > 0 AND tag != 'cancel' AND date >= ? ORDER BY date`).bind(org.id, ...src, addDays(from, -366)).all();
    const got = ((rows.results || []) as any[]).filter((b) => addDays(b.date, b.nights) >= from);
    const u = U[apt] || {};
    if (unitApt && u.kind === "dorm" && +u.dbeds > 0) {
      // a hostel dorm is sold by the bed: only the nights when every bed is taken close it on the other sites
      const used: Record<string, number> = {};
      for (const b of got) for (let i = 0; i < b.nights; i++) { const d = addDays(b.date, i); used[d] = (used[d] || 0) + (b.apt === apt ? Math.max(1, +b.pax || 1) : 1e6); }
      const full = Object.keys(used).filter((d) => used[d] >= +u.dbeds).sort();
      for (let i = 0; i < full.length;) { let j = i; while (j + 1 < full.length && full[j + 1] === addDays(full[j], 1)) j++;
        list.push({ id: "full-" + apt + "-" + full[i], date: full[i], nights: j - i + 1, tag: "closed", apt }); i = j + 1; }
    } else for (const b of got) list.push({ ...b, apt });
    const closed = ((await env.DB.prepare("SELECT day FROM day_rates WHERE org_id = ? AND apt = ? AND closed = 1 AND day >= ? ORDER BY day").bind(org.id, apt, from).all()).results || []).map((r: any) => r.day as string);
    for (let i = 0; i < closed.length;) {
      let j = i; while (j + 1 < closed.length && closed[j + 1] === addDays(closed[j], 1)) j++;
      list.push({ id: "closed-" + apt + "-" + closed[i], date: closed[i], nights: j - i + 1, tag: "closed", apt });
      i = j + 1;
    }
  }
  list.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.apt || "").localeCompare(String(b.apt || "")));
  const body = buildIcs(org.name, unitApt || "all", list, { all: orgAll });
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-cache" } });
};
