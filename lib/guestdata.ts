// Guest personal data on request (data-protection law): export everything about one contact, or erase it.
// Erase = the contact is deleted, bookings keep their dates and money but lose name/phone/email,
// check-in data and booking files are removed. Issued guest invoices and signed contracts are kept
// (fiscal / legal documents), only unsigned contracts are cleared.
import { all, one, run, nowIso } from "./core";
import { matchesContact } from "./contacts";

async function guestBookings(db: D1Database, orgId: string, c: any) {
  const rows = await all(db, `SELECT * FROM bookings WHERE org_id = ? AND (phone != '' OR email != '')`, orgId);
  return rows.filter((b: any) => matchesContact(c, b));
}
const inList = (ids: string[]) => ids.map(() => "?").join(",");
const parse = (s: any) => { try { return JSON.parse(s || "{}"); } catch { return {}; } };

/** Every apartment a booking of this guest is in — the caller checks the member may see them all. */
export async function guestApts(db: D1Database, orgId: string, id: string) {
  const c = await one(db, "SELECT * FROM contacts WHERE org_id = ? AND id = ?", orgId, id);
  if (!c) return null;
  return [...new Set((await guestBookings(db, orgId, c)).map((b: any) => String(b.apt)))];
}

export async function exportGuest(db: D1Database, orgId: string, id: string) {
  const c = await one(db, "SELECT * FROM contacts WHERE org_id = ? AND id = ?", orgId, id);
  if (!c) return null;
  const books = await guestBookings(db, orgId, c);
  const ids = books.map((b: any) => String(b.id));
  const q = async (sql: string) => ids.length ? all(db, sql.replace("(?)", `(${inList(ids)})`), orgId, ...ids) : [];
  const [checkins, files, invoices, contracts, payments, messages] = await Promise.all([
    q("SELECT booking_id, status, data, completed_at FROM checkins WHERE org_id = ? AND booking_id IN (?)"),
    q("SELECT booking_id, name, mime, size, created_at FROM booking_files WHERE org_id = ? AND booking_id IN (?)"),
    q("SELECT booking_id, number, issued_at, amount, currency, status, buyer FROM guest_invoices WHERE org_id = ? AND booking_id IN (?)"),
    q("SELECT booking_id, number, status, guest_name, guest_doc, guest_country, guest_pax, signed_at FROM contracts WHERE org_id = ? AND booking_id IN (?)"),
    q("SELECT booking_id, kind, amount, cur, status, created_at FROM guest_payments WHERE org_id = ? AND booking_id IN (?)"),
    q("SELECT booking_id, channel, to_addr, subject, created_at FROM msg_sent WHERE org_id = ? AND booking_id IN (?)"),
  ]);
  const svc = c.phone_norm ? (await all(db, "SELECT service_name, price, price_cur, guest, phone, note, status, created_at FROM svc_orders WHERE org_id = ? AND phone != ''", orgId))
    .filter((s: any) => matchesContact(c, s)) : [];
  return {
    exported_at: nowIso(),
    contact: { name: c.name, phone: c.phone, email: c.email, note: c.note, flag: c.flag, created_at: c.created_at },
    bookings: books.map((b: any) => ({ id: b.id, apt: b.apt, date: b.date, nights: b.nights, guest: b.guest, phone: b.phone, email: b.email,
      pax: b.pax, price: b.price, price_cur: b.price_cur, source: b.source, tag: b.tag, created_at: b.created_at })),
    checkins: checkins.map((r: any) => ({ ...r, data: parse(r.data) })),
    files, invoices: invoices.map((r: any) => ({ ...r, buyer: parse(r.buyer) })), contracts, payments, messages, service_orders: svc,
  };
}

export async function forgetGuest(db: D1Database, orgId: string, id: string, files?: R2Bucket) {
  const c = await one(db, "SELECT * FROM contacts WHERE org_id = ? AND id = ?", orgId, id);
  if (!c) return null;
  const books = await guestBookings(db, orgId, c);
  const ids = books.map((b: any) => String(b.id));
  const t = nowIso();
  const secrets = [...new Set([c.name, c.phone, c.email, ...books.flatMap((b: any) => [b.guest, b.phone, b.email])]
    .map((s: any) => String(s || "").trim()).filter((s) => s.length >= 3))];
  let nFiles = 0;
  if (ids.length) {
    const IN = `(${inList(ids)})`;
    const fl = await all(db, `SELECT id, r2_key FROM booking_files WHERE org_id = ? AND booking_id IN ${IN}`, orgId, ...ids);
    if (files) for (const f of fl) if (f.r2_key) await files.delete(f.r2_key).catch(() => {});
    nFiles = fl.length;
    await run(db, `DELETE FROM booking_files WHERE org_id = ? AND booking_id IN ${IN}`, orgId, ...ids);
    await run(db, `UPDATE checkins SET data = '{}', status = 'purged', updated_at = ? WHERE org_id = ? AND booking_id IN ${IN}`, t, orgId, ...ids);
    await run(db, `UPDATE contracts SET guest_name = '', guest_doc = '', guest_country = '' WHERE org_id = ? AND status != 'signed' AND booking_id IN ${IN}`, orgId, ...ids);
    await run(db, `UPDATE guest_payments SET guest = '' WHERE org_id = ? AND booking_id IN ${IN}`, orgId, ...ids);
    await run(db, `UPDATE msg_sent SET to_addr = '', body = '' WHERE org_id = ? AND booking_id IN ${IN}`, orgId, ...ids);
    await run(db, `UPDATE bookings SET guest = '—', phone = '', email = '', updated_at = ? WHERE org_id = ? AND id IN ${IN}`, t, orgId, ...ids);
  }
  for (const s of (await all(db, "SELECT id, phone FROM svc_orders WHERE org_id = ? AND phone != ''", orgId)).filter((r: any) => matchesContact(c, r)))
    await run(db, "UPDATE svc_orders SET guest = '', phone = '' WHERE org_id = ? AND id = ?", orgId, s.id);
  // the change log keeps who did what, but not the guest's name / phone / email
  const refs = [...ids, String(id)], RIN = `(${inList(refs)})`;
  for (const s of secrets)
    await run(db, `UPDATE audit SET data = REPLACE(data, ?, '×'), label = REPLACE(label, ?, '×') WHERE org_id = ? AND ref IN ${RIN}`, s, s, orgId, ...refs);
  // the log of emails sent (requests, confirmations, contracts): the address and the subject with the name go too
  const mails = [...new Set([c.email, ...books.map((b: any) => b.email)].map((s: any) => String(s || "").trim().toLowerCase()).filter((s) => s.includes("@")))];
  for (const m of mails) await run(db, "UPDATE emails SET to_addr = '×', subject = '' WHERE org_id = ? AND LOWER(to_addr) = ?", orgId, m).catch(() => {});
  // issued guest invoices stay as they are: accounting law requires keeping them
  await run(db, "DELETE FROM contacts WHERE org_id = ? AND id = ?", orgId, id);
  return { bookings: ids.length, files: nFiles };
}
