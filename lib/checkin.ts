// Online guest check-in: token link, configurable fields, JSON payload, auto-purge after N months.
import { all, one, run, uuid, str, isUuid, nowIso, today, addDays } from "./core";

export type FieldMode = "req" | "opt" | "hide";
export const CHECKIN_FIELDS = [
  "name", "birth", "citizenship", "doc_type", "doc_num", "doc_issued", "doc_expires",
  "address", "companions", "doc_photo", "signature",
] as const;
export type CheckinField = (typeof CHECKIN_FIELDS)[number];

export type CheckinCfg = {
  fields: Record<CheckinField, FieldMode>;
  retain_months: number; // 0 = keep forever (not recommended)
};

export function defaultCheckinCfg(): CheckinCfg {
  const fields = {} as Record<CheckinField, FieldMode>;
  for (const f of CHECKIN_FIELDS) fields[f] = f === "companions" || f === "doc_photo" ? "opt" : "req";
  return { fields, retain_months: 12 };
}

export function checkinCfgOf(cfg: any): CheckinCfg {
  const d = defaultCheckinCfg();
  const raw = cfg?.checkin || {};
  const fields = { ...d.fields };
  for (const f of CHECKIN_FIELDS) {
    if (["req", "opt", "hide"].includes(raw.fields?.[f])) fields[f] = raw.fields[f];
  }
  const retain = Math.max(0, Math.min(60, Math.floor(Number(raw.retain_months) || d.retain_months)));
  return { fields, retain_months: retain };
}

function tok() {
  const a = "abcdef0123456789";
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => a[b % 16]).join("");
}

export async function ensureCheckin(db: D1Database, orgId: string, bookingId: string) {
  if (!isUuid(bookingId)) return null;
  const b = await one(db, "SELECT id, guest, email, phone, apt, date, nights FROM bookings WHERE org_id = ? AND id = ?", orgId, bookingId);
  if (!b) return null;
  let row = await one(db, "SELECT * FROM checkins WHERE org_id = ? AND booking_id = ?", orgId, bookingId);
  if (!row) {
    const id = uuid(), token = tok(), t = nowIso();
    await run(db, `INSERT INTO checkins(id, org_id, booking_id, token, status, data, created_at, updated_at)
      VALUES (?,?,?,?, 'open', '{}', ?, ?)`, id, orgId, bookingId, token, t, t);
    row = await one(db, "SELECT * FROM checkins WHERE id = ?", id);
  }
  return row;
}

export function parseData(raw: string) {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}

export function validateSubmit(cfg: CheckinCfg, body: any): { ok: true; data: any } | { ok: false; message: string } {
  const data: any = {};
  for (const f of CHECKIN_FIELDS) {
    const mode = cfg.fields[f];
    if (mode === "hide") continue;
    let v: any = body[f];
    if (f === "companions") {
      const list = Array.isArray(v) ? v : String(v || "").split(/\n|,/).map((x: string) => x.trim()).filter(Boolean);
      v = list.map((x: string) => str(x, 80)).slice(0, 20);
      if (mode === "req" && !v.length) return { ok: false, message: "need_" + f };
      data[f] = v;
      continue;
    }
    if (f === "doc_photo") {
      v = str(v, 700000);
      if (v && !/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) return { ok: false, message: "bad_photo" };
      if (mode === "req" && !v) return { ok: false, message: "need_" + f };
      if (v) data[f] = v;
      continue;
    }
    if (f === "signature") {
      v = str(v, 300000);
      if (v && !/^data:image\/png;base64,[A-Za-z0-9+/=]{200,}$/.test(v)) return { ok: false, message: "bad_signature" };
      if (mode === "req" && !v) return { ok: false, message: "need_" + f };
      if (v) data[f] = v;
      continue;
    }
    if (f === "birth" || f === "doc_issued" || f === "doc_expires") {
      v = str(v, 12);
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, message: "bad_" + f };
    } else {
      v = str(v, f === "address" ? 300 : 120);
    }
    if (mode === "req" && !v) return { ok: false, message: "need_" + f };
    if (v) data[f] = v;
  }
  return { ok: true, data };
}

/** Delete completed check-ins older than retain_months (per org config). */
export async function purgeCheckins(db: D1Database, limit = 80) {
  const orgs = await all(db, "SELECT org_id, data FROM app_config LIMIT 200");
  let n = 0;
  for (const o of orgs) {
    let cfg: any = {}; try { cfg = JSON.parse(o.data || "{}"); } catch {}
    const c = checkinCfgOf(cfg);
    if (!(c.retain_months > 0)) continue;
    const cut = addDays(today(), -Math.round(c.retain_months * 30.5));
    const rows = await all(db, `SELECT id FROM checkins WHERE org_id = ? AND status = 'done' AND completed_at != '' AND completed_at < ? LIMIT ?`,
      o.org_id, cut + "T00:00:00.000Z", Math.max(1, Math.floor(limit / Math.max(1, orgs.length))));
    for (const r of rows) {
      await run(db, "UPDATE checkins SET data = '{}', status = 'purged', updated_at = ? WHERE id = ?", nowIso(), r.id);
      n++;
    }
  }
  return n;
}
