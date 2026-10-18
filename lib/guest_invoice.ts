// Guest invoices (to the guest, not platform credits) + discount codes for the public booking page.
import { all, one, run, uuid, str, num, isDate, isUuid, nowIso, today, addDays, randCode } from "./core";

export type InvoiceSeller = {
  name: string; idno: string; vat_code: string; address: string;
  bank: string; bic: string; iban: string; email: string; phone: string; footer: string;
};
export type InvoiceCfg = InvoiceSeller & {
  vat: boolean; vat_rate: number; lang: "ro" | "ru" | "en"; prefix: string; due_days: number;
};

const SELLER_KEYS: (keyof InvoiceSeller)[] = ["name", "idno", "vat_code", "address", "bank", "bic", "iban", "email", "phone", "footer"];

export function defaultInvoiceCfg(): InvoiceCfg {
  return {
    name: "", idno: "", vat_code: "", address: "", bank: "", bic: "", iban: "", email: "", phone: "", footer: "",
    vat: false, vat_rate: 20, lang: "ro", prefix: "F", due_days: 5,
  };
}

export function invoiceCfgOf(cfg: any): InvoiceCfg {
  const d = defaultInvoiceCfg(), raw = cfg?.invoice || {};
  const o: any = { ...d };
  for (const k of SELLER_KEYS) o[k] = str(raw[k], k === "footer" || k === "address" ? 500 : 120);
  o.vat = !!raw.vat;
  o.vat_rate = Math.max(0, Math.min(40, num(raw.vat_rate) || 20));
  o.lang = ["ro", "ru", "en"].includes(raw.lang) ? raw.lang : "ro";
  o.prefix = (str(raw.prefix, 12) || "F").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12) || "F";
  o.due_days = Math.max(0, Math.min(90, Math.floor(num(raw.due_days) || 5)));
  return o as InvoiceCfg;
}

export function sellerReady(s: InvoiceCfg) {
  return !!(s.name && (s.idno || s.iban || s.address));
}

async function nextNumber(db: D1Database, orgId: string, prefix: string) {
  const y = today().slice(0, 4), key = `ginv_seq_${y}`;
  const cur = await one(db, "SELECT v FROM app_state WHERE org_id = ? AND k = ?", orgId, key);
  const n = (Math.max(0, Math.floor(Number(cur?.v) || 0)) + 1);
  await run(db, "INSERT INTO app_state(org_id, k, v) VALUES (?,?,?) ON CONFLICT (org_id, k) DO UPDATE SET v = excluded.v", orgId, key, String(n));
  return `${prefix}-${y}-${String(n).padStart(4, "0")}`;
}

export type GuestInvoiceLine = { name: string; qty: number; price: number; sum: number };

export async function createGuestInvoice(
  db: D1Database,
  org: { id: string; name: string; code: string },
  cfg: any,
  booking: any,
  opts: { amount?: number; note?: string; actor?: string } = {},
) {
  const inv = invoiceCfgOf(cfg);
  if (!sellerReady(inv)) return { error: "need_seller" as const };
  if (!booking || !(booking.nights > 0) || booking.tag === "closed") return { error: "bad_booking" as const };
  const cur = ["EUR", "MDL", "USD"].includes(booking.price_cur) ? booking.price_cur : "EUR";
  const amount = opts.amount != null && opts.amount > 0 ? Math.round(num(opts.amount) * 100) / 100 : Math.round(num(booking.price) * 100) / 100;
  if (!(amount > 0)) return { error: "bad_amount" as const };
  const open = await one(db, "SELECT COUNT(*) AS n FROM guest_invoices WHERE org_id = ? AND booking_id = ? AND status = 'sent'", org.id, booking.id);
  if ((open?.n || 0) >= 5) return { error: "too_many_open" as const };

  const issued = today(), due = addDays(issued, inv.due_days);
  const nights = Math.max(1, Math.floor(+booking.nights || 1));
  const unit = Math.round((amount / nights) * 100) / 100;
  const lines: GuestInvoiceLine[] = [{
    name: `${booking.apt} · ${booking.date} · ${nights} n.`,
    qty: nights, price: unit, sum: amount,
  }];
  const buyer = {
    name: str(booking.guest, 120),
    email: str(booking.email, 120),
    phone: str(booking.phone, 40),
  };
  const seller: InvoiceSeller = {
    name: inv.name || org.name, idno: inv.idno, vat_code: inv.vat_code, address: inv.address,
    bank: inv.bank, bic: inv.bic, iban: inv.iban, email: inv.email, phone: inv.phone, footer: inv.footer,
  };
  const id = uuid(), token = randCode(16), number = await nextNumber(db, org.id, inv.prefix);
  await run(db, `INSERT INTO guest_invoices(id, org_id, booking_id, number, token, issued_at, due_at, amount, currency, lang, status, buyer, seller, lines, note, vat, vat_rate)
    VALUES (?,?,?,?,?,?,?,?,?,?,'sent',?,?,?,?,?,?)`,
    id, org.id, booking.id, number, token, issued, due, amount, cur, inv.lang,
    JSON.stringify(buyer), JSON.stringify(seller), JSON.stringify(lines), str(opts.note, 500),
    inv.vat ? 1 : 0, inv.vat_rate);
  const url = `https://${org.code}.espace.md/factura/${token}`;
  return { id, number, token, url, amount, currency: cur, due_at: due, lang: inv.lang };
}

export type DiscountRow = {
  id: string; code: string; kind: "pct" | "sum"; value: number; currency: string;
  from_date: string; to_date: string; max_uses: number; used_count: number;
  apts: string[]; active: number; note: string;
};

export function parseApts(raw: string): string[] {
  try {
    const a = JSON.parse(raw || "[]");
    return Array.isArray(a) ? a.map((x) => str(x, 100)).filter(Boolean).slice(0, 80) : [];
  } catch { return []; }
}

export function normalizeCode(c: string) {
  return str(c, 40).toUpperCase().replace(/\s+/g, "");
}

export async function findDiscount(db: D1Database, orgId: string, code: string) {
  const c = normalizeCode(code);
  if (!c || c.length < 2) return null;
  const row = await one(db, "SELECT * FROM discount_codes WHERE org_id = ? AND code = ?", orgId, c);
  return row || null;
}

/** Validate a discount against stay dates / unit / usage. Returns the money off from `total`. */
export function applyDiscount(row: any, total: number, apt: string, stayFrom: string): { ok: true; off: number; kind: "pct" | "sum"; value: number } | { ok: false; message: string } {
  if (!row || !row.active) return { ok: false, message: "bad_code" };
  const kind = row.kind === "sum" ? "sum" : "pct";
  const value = num(row.value);
  if (!(value > 0)) return { ok: false, message: "bad_code" };
  const t = today();
  if (row.from_date && isDate(row.from_date) && t < row.from_date) return { ok: false, message: "not_started" };
  if (row.to_date && isDate(row.to_date) && t > row.to_date) return { ok: false, message: "expired" };
  const max = Math.floor(num(row.max_uses));
  if (max > 0 && Math.floor(num(row.used_count)) >= max) return { ok: false, message: "exhausted" };
  const apts = parseApts(row.apts);
  if (apts.length && !apts.includes(apt)) return { ok: false, message: "wrong_unit" };
  if (stayFrom && row.from_date && isDate(row.from_date) && stayFrom < row.from_date) return { ok: false, message: "not_started" };
  let off = 0;
  if (kind === "pct") off = Math.round(total * Math.min(90, value) / 100 * 100) / 100;
  else off = Math.min(total, value);
  off = Math.max(0, Math.round(off * 100) / 100);
  if (!(off > 0)) return { ok: false, message: "bad_code" };
  return { ok: true, off, kind, value };
}

export async function bumpDiscountUse(db: D1Database, orgId: string, id: string) {
  if (!isUuid(id)) return;
  await run(db, "UPDATE discount_codes SET used_count = used_count + 1 WHERE org_id = ? AND id = ?", orgId, id);
}

export function rowToDiscount(r: any): DiscountRow {
  return {
    id: r.id, code: r.code, kind: r.kind === "sum" ? "sum" : "pct", value: num(r.value),
    currency: str(r.currency, 5), from_date: r.from_date || "", to_date: r.to_date || "",
    max_uses: Math.floor(num(r.max_uses)), used_count: Math.floor(num(r.used_count)),
    apts: parseApts(r.apts), active: r.active ? 1 : 0, note: str(r.note, 200),
  };
}

export async function listDiscounts(db: D1Database, orgId: string) {
  return (await all(db, "SELECT * FROM discount_codes WHERE org_id = ? ORDER BY created_at DESC", orgId)).map(rowToDiscount);
}
