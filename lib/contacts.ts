// Guest contacts (CRM): auto-built from bookings by phone/email, notes, VIP / blocked, merge, CSV.
import { all, one, run, uuid, str, isEmail, nowIso } from "./core";

export function normPhone(raw: string) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 9 && d[0] === "0") d = "373" + d.slice(1);
  if (d.length === 8) d = "373" + d;
  return d.length >= 8 ? d.slice(-12) : "";
}
export function normEmail(raw: string) {
  const e = String(raw || "").trim().toLowerCase();
  return isEmail(e) ? e : "";
}

/** Find existing contact by normalized phone or email (same org). */
export async function findContact(db: D1Database, orgId: string, phone: string, email: string) {
  const pn = normPhone(phone), em = normEmail(email);
  if (pn) {
    const byP = await one(db, "SELECT * FROM contacts WHERE org_id = ? AND phone_norm = ?", orgId, pn);
    if (byP) return byP;
  }
  if (em) {
    const byE = await one(db, "SELECT * FROM contacts WHERE org_id = ? AND email_norm = ?", orgId, em);
    if (byE) return byE;
  }
  return null;
}

/** Create or refresh a contact from a booking's guest fields. No-op without phone or email. */
export async function upsertFromBooking(db: D1Database, orgId: string, b: { guest?: string; phone?: string; email?: string }) {
  const phone = str(b.phone, 40), email = str(b.email, 120).toLowerCase();
  const pn = normPhone(phone), em = normEmail(email);
  if (!pn && !em) return null;
  const name = str(b.guest, 200);
  const ex = await findContact(db, orgId, phone, email);
  const t = nowIso();
  if (ex) {
    const nextName = name && (!ex.name || ex.name.length < name.length) ? name : ex.name;
    const nextPhone = phone || ex.phone;
    const nextEmail = em || ex.email;
    const nextPn = normPhone(nextPhone) || ex.phone_norm;
    const nextEm = normEmail(nextEmail) || ex.email_norm;
    await run(db, `UPDATE contacts SET name = ?, phone = ?, phone_norm = ?, email = ?, email_norm = ?, updated_at = ? WHERE org_id = ? AND id = ?`,
      nextName, nextPhone, nextPn, nextEmail, nextEm, t, orgId, ex.id);
    return ex.id as string;
  }
  const id = uuid();
  await run(db, `INSERT INTO contacts(id, org_id, name, phone, phone_norm, email, email_norm, note, flag, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,'','',?,?)`, id, orgId, name, phone, pn, em ? email : "", em, t, t);
  return id;
}

/** Rebuild contacts from all bookings that have phone or email (idempotent upsert). */
export async function syncAll(db: D1Database, orgId: string) {
  const rows = await all(db, "SELECT guest, phone, email FROM bookings WHERE org_id = ? AND (phone != '' OR email != '')", orgId);
  let n = 0;
  for (const b of rows) {
    if (await upsertFromBooking(db, orgId, b)) n++;
  }
  return n;
}

function paidEur(b: any, rates: { eur: number; usd: number }) {
  const eurR = rates.eur > 0 ? rates.eur : 20;
  const usdR = rates.usd > 0 ? rates.usd : 0.85;
  return (Number(b.eur) || 0) + (Number(b.mdl) || 0) / eurR + (Number(b.usd) || 0) * usdR
    + ((Number(b.oth) || 0) > 0 && b.oth_cur === "EUR" ? Number(b.oth) : 0);
}

function matchesContact(c: any, b: any) {
  const bp = normPhone(b.phone || ""), be = normEmail(b.email || "");
  if (c.phone_norm && bp && (bp === c.phone_norm || bp.endsWith(c.phone_norm) || c.phone_norm.endsWith(bp))) return true;
  if (c.email_norm && be && be === c.email_norm) return true;
  return false;
}

export async function listContacts(db: D1Database, orgId: string, q: string, cfg: any) {
  const rates = { eur: +(cfg?.rates?.eur) || 20, usd: +(cfg?.rates?.usd) || 0.85 };
  const rows = await all(db, "SELECT * FROM contacts WHERE org_id = ? ORDER BY updated_at DESC", orgId);
  const books = await all(db, `SELECT id, date, apt, guest, nights, phone, email, price, price_cur, mdl, eur, usd, oth, oth_cur, tag, source
    FROM bookings WHERE org_id = ? AND nights > 0 AND tag != 'closed' AND (phone != '' OR email != '') ORDER BY date DESC`, orgId);
  const fq = String(q || "").toLowerCase().trim();
  const dq = String(q || "").replace(/\D/g, "");
  const out: any[] = [];
  for (const c of rows) {
    if (fq) {
      const hay = [c.name, c.phone, c.email, c.note, c.flag].join(" ").toLowerCase();
      const ok = hay.includes(fq) || (dq.length >= 4 && String(c.phone_norm || "").includes(dq));
      if (!ok) continue;
    }
    const mine = books.filter((b) => matchesContact(c, b));
    let paid = 0, nights = 0;
    for (const b of mine) { paid += paidEur(b, rates); nights += Number(b.nights) || 0; }
    out.push({
      id: c.id, name: c.name, phone: c.phone, email: c.email, note: c.note, flag: c.flag || "",
      n: mine.length, nights, paid: Math.round(paid * 100) / 100,
      last: mine[0]?.date || "", apts: [...new Set(mine.map((b: any) => b.apt))],
      updated_at: c.updated_at, created_at: c.created_at,
    });
  }
  out.sort((a, b) => (b.last || "").localeCompare(a.last || "") || (b.n - a.n));
  return out;
}

export async function getContact(db: D1Database, orgId: string, id: string, cfg: any) {
  const c = await one(db, "SELECT * FROM contacts WHERE org_id = ? AND id = ?", orgId, id);
  if (!c) return null;
  const rates = { eur: +(cfg?.rates?.eur) || 20, usd: +(cfg?.rates?.usd) || 0.85 };
  const allB = await all(db, `SELECT id, date, apt, guest, nights, phone, email, price, price_cur, mdl, eur, usd, oth, oth_cur, tag, source, pay_status
    FROM bookings WHERE org_id = ? AND (phone != '' OR email != '') ORDER BY date DESC`, orgId);
  const books = allB.filter((b) => matchesContact(c, b));
  let paid = 0, nights = 0;
  for (const b of books.filter((x: any) => x.nights > 0 && x.tag !== "closed")) {
    paid += paidEur(b, rates); nights += Number(b.nights) || 0;
  }
  const dups = await all(db, `SELECT id, name, phone, email, flag FROM contacts WHERE org_id = ? AND id != ? AND (
    (phone_norm != '' AND phone_norm = ?) OR (email_norm != '' AND email_norm = ?))`,
    orgId, id, c.phone_norm || "__none__", c.email_norm || "__none__");
  return {
    id: c.id, name: c.name, phone: c.phone, email: c.email, note: c.note, flag: c.flag || "",
    n: books.filter((x: any) => x.nights > 0 && x.tag !== "closed").length,
    nights, paid: Math.round(paid * 100) / 100,
    bookings: books.slice(0, 80), dups, created_at: c.created_at, updated_at: c.updated_at,
  };
}

export async function saveContact(db: D1Database, orgId: string, body: any) {
  const name = str(body.name, 200), phone = str(body.phone, 40), email = str(body.email, 120).toLowerCase();
  const note = str(body.note, 2000), flag = ["vip", "block", ""].includes(str(body.flag, 10)) ? str(body.flag, 10) : "";
  const pn = normPhone(phone), em = normEmail(email);
  if (!name && !pn && !em) return { error: "need_contact", status: 400 as const };
  if (email && !em) return { error: "bad_email", status: 400 as const };
  const t = nowIso();
  if (body.id) {
    const ex = await one(db, "SELECT id FROM contacts WHERE org_id = ? AND id = ?", orgId, str(body.id, 40));
    if (!ex) return { error: "not_found", status: 404 as const };
    // uniqueness: another contact already owns this phone/email
    if (pn) {
      const clash = await one(db, "SELECT id FROM contacts WHERE org_id = ? AND phone_norm = ? AND id != ?", orgId, pn, ex.id);
      if (clash) return { error: "dup_phone", status: 409 as const, other: clash.id };
    }
    if (em) {
      const clash = await one(db, "SELECT id FROM contacts WHERE org_id = ? AND email_norm = ? AND id != ?", orgId, em, ex.id);
      if (clash) return { error: "dup_email", status: 409 as const, other: clash.id };
    }
    await run(db, `UPDATE contacts SET name=?, phone=?, phone_norm=?, email=?, email_norm=?, note=?, flag=?, updated_at=? WHERE org_id=? AND id=?`,
      name, phone, pn, em ? email : "", em, note, flag, t, orgId, ex.id);
    return { id: ex.id as string };
  }
  if (pn) {
    const clash = await one(db, "SELECT id FROM contacts WHERE org_id = ? AND phone_norm = ?", orgId, pn);
    if (clash) return { error: "dup_phone", status: 409 as const, other: clash.id };
  }
  if (em) {
    const clash = await one(db, "SELECT id FROM contacts WHERE org_id = ? AND email_norm = ?", orgId, em);
    if (clash) return { error: "dup_email", status: 409 as const, other: clash.id };
  }
  const id = uuid();
  await run(db, `INSERT INTO contacts(id, org_id, name, phone, phone_norm, email, email_norm, note, flag, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`, id, orgId, name, phone, pn, em ? email : "", em, note, flag, t, t);
  return { id };
}

/** Merge other → keep: copy note/flag if empty, retarget bookings' phone/email, delete other. */
export async function mergeContacts(db: D1Database, orgId: string, keepId: string, otherId: string) {
  if (keepId === otherId) return { error: "same", status: 400 as const };
  const keep = await one(db, "SELECT * FROM contacts WHERE org_id = ? AND id = ?", orgId, keepId);
  const other = await one(db, "SELECT * FROM contacts WHERE org_id = ? AND id = ?", orgId, otherId);
  if (!keep || !other) return { error: "not_found", status: 404 as const };
  const name = keep.name || other.name;
  const phone = keep.phone || other.phone;
  const email = keep.email || other.email;
  const note = [keep.note, other.note].filter(Boolean).join("\n").slice(0, 2000);
  const flag = keep.flag || other.flag || "";
  const pn = normPhone(phone), em = normEmail(email);
  const t = nowIso();
  // retarget bookings that matched the other contact onto keep's identifiers
  if (other.phone_norm && pn) {
    await run(db, `UPDATE bookings SET phone = ?, updated_at = ? WHERE org_id = ? AND REPLACE(REPLACE(REPLACE(phone,'+',''),' ',''),'-','') LIKE ?`,
      phone, t, orgId, "%" + other.phone_norm);
  }
  if (other.email_norm && em) {
    await run(db, `UPDATE bookings SET email = ?, updated_at = ? WHERE org_id = ? AND lower(email) = ?`,
      email, t, orgId, other.email_norm);
  }
  await run(db, `UPDATE contacts SET name=?, phone=?, phone_norm=?, email=?, email_norm=?, note=?, flag=?, updated_at=? WHERE org_id=? AND id=?`,
    name, phone, pn, em ? email : "", em, note, flag, t, orgId, keep.id);
  await run(db, "DELETE FROM contacts WHERE org_id = ? AND id = ?", orgId, other.id);
  return { id: keep.id as string };
}

export function toCsv(rows: any[]) {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = ["name", "phone", "email", "flag", "note", "bookings", "nights", "paid_eur", "last", "apts"];
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push([r.name, r.phone, r.email, r.flag, r.note, r.n, r.nights, r.paid, r.last, (r.apts || []).join("|")].map(esc).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
