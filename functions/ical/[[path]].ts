// /ical/<company>/<key>.ics — a unit's taken dates, to paste into Airbnb / Booking.com ("import calendar").
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
  const apt = (cfg.apts || []).find((a: string) => (cfg.units || {})[a]?.ical === key);
  if (!apt) return nf();
  const from = addDays(today(), -30);
  const rows = await env.DB.prepare("SELECT id, date, nights, tag FROM bookings WHERE org_id = ? AND apt = ? AND nights > 0 AND date >= ? ORDER BY date").bind(org.id, apt, addDays(from, -366)).all();
  const list = (rows.results || []).filter((b: any) => addDays(b.date, b.nights) >= from);
  return new Response(buildIcs(org.name, apt, list), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-cache" } });
};
