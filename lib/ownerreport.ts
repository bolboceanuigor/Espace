// Owner's report by email: daily (every morning) or weekly (Monday morning), from 08:00 Moldova time.
// Settings: cfg.ownerReport = { freq: "daily" | "weekly", to?: email }. Goes out once per period (sendMail dedupe key).
import { type Env, all, one, billingOf } from "./core";
import { sendMail, orgEmail, orgUrl } from "./mail";
import { localToday, addDaysIso } from "./stay";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const dm = (d: string) => d.slice(8, 10) + "." + d.slice(5, 7);
const n0 = (v: number) => Math.round(v).toLocaleString("ru-RU").replace(/ /g, " ");
const endOf = (b: any) => addDaysIso(b.date, Math.max(0, Number(b.nights) || 0));

function localHour(tz = "Europe/Chisinau") {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date())) % 24;
}

export async function buildOwnerReport(db: D1Database, org: any, cfg: any, freq: "daily" | "weekly", t: string) {
  const weekly = freq === "weekly";
  const from = t, to = weekly ? addDaysIso(t, 6) : t;               // arrivals / departures ahead
  const pFrom = weekly ? addDaysIso(t, -7) : addDaysIso(t, -1), pTo = addDaysIso(t, -1); // money of the period just ended
  const rates = cfg.rates || {}, eurMdl = Number(rates.eur) || 20, usdEur = Number(rates.usd) || 0.85;
  const eur = (x: any) => (Number(x.mdl) || 0) / eurMdl + (Number(x.eur) || 0) + (Number(x.usd) || 0) * usdEur;
  const toEur = (v: number, c: string) => (c === "MDL" ? v / eurMdl : c === "USD" ? v * usdEur : v);
  const all_ = await all(db, "SELECT * FROM bookings WHERE org_id = ? AND date >= ? AND date <= ?", org.id, addDaysIso(t, -60), addDaysIso(t, 14));
  const live = all_.filter((b: any) => b.tag !== "cancel" && b.tag !== "closed" && b.tag !== "req");
  const stays = live.filter((b: any) => Number(b.nights) > 0);
  const arr = stays.filter((b: any) => b.date >= from && b.date <= to).sort((a: any, b: any) => a.date.localeCompare(b.date) || String(a.apt).localeCompare(String(b.apt)));
  const dep = stays.filter((b: any) => endOf(b) >= from && endOf(b) <= to).sort((a: any, b: any) => endOf(a).localeCompare(endOf(b)));
  // money recorded on stays that started in the past period (+ extra rows inside them), split by currency
  const cur = { MDL: 0, EUR: 0, USD: 0 } as Record<string, number>;
  for (const b of live.filter((b: any) => b.date >= pFrom && b.date <= pTo)) { cur.MDL += Number(b.mdl) || 0; cur.EUR += Number(b.eur) || 0; cur.USD += Number(b.usd) || 0; }
  const paidEur = (b: any) => eur(b) + live.filter((x: any) => x.id !== b.id && !(Number(x.nights) > 0) && x.apt === b.apt && x.date >= b.date && x.date < endOf(b)).reduce((a: number, x: any) => a + eur(x), 0);
  const unpaid = stays.filter((b: any) => Number(b.price) > 0 && b.date >= addDaysIso(t, -14) && b.date <= addDaysIso(t, 7) && b.source !== "Airbnb" && b.pay !== "Airbnb")
    .map((b: any) => ({ b, left: toEur(Number(b.price), b.price_cur || "EUR") - paidEur(b) })).filter((x: any) => x.left > 1)
    .sort((a: any, b: any) => a.b.date.localeCompare(b.b.date));
  const cleanings = await one(db, "SELECT COUNT(*) AS n FROM tasks WHERE org_id = ? AND kind IN ('clean','general') AND status != 'skip' AND date >= ? AND date <= ?", org.id, from, to);
  const nClean = Math.max(Number(cleanings?.n) || 0, dep.length);
  const bill = await billingOf(db, org);

  const money = Object.entries(cur).filter(([, v]) => v).map(([c, v]) => `${n0(v)} ${c === "MDL" ? "lei" : c === "EUR" ? "€" : "$"}`).join(" · ") || "—";
  const li = (b: any, d: string) => `<li><b>${esc(dm(d))}</b> · ${esc(b.apt)} · ${esc(b.guest || "—")}</li>`;
  const list = (rows: string[], empty: string) => rows.length ? `<ul style="padding-left:18px;margin:6px 0 14px">${rows.slice(0, 25).join("")}${rows.length > 25 ? `<li>+${rows.length - 25}</li>` : ""}</ul>` : `<p style="margin:6px 0 14px;color:#868aa1">${empty}</p>`;
  const per = weekly ? `${dm(from)}–${dm(to)}` : dm(t);
  const kpi = (v: string, l: string) => `<td style="padding:10px;background:#f5f6f9;border-radius:10px;text-align:center"><div style="font-size:20px;font-weight:800">${v}</div><div style="font-size:12px;color:#4c5068">${l}</div></td>`;
  const body = (L: "ro" | "ru") => {
    const T = L === "ro"
      ? { arr: "Sosiri", dep: "Plecări", cln: "curățenii", money: weekly ? "Încasat săptămâna trecută" : "Încasat ieri", unpaid: "Neplătite (−14…+7 zile)", none: "Nimic", bal: "Sold", days: "zile" }
      : { arr: "Заезды", dep: "Выезды", cln: "уборок", money: weekly ? "Получено за прошлую неделю" : "Получено вчера", unpaid: "Не оплачено (−14…+7 дней)", none: "Нет", bal: "Баланс", days: "дн." };
    return `<table role="presentation" width="100%" cellspacing="6" style="margin:0 0 12px"><tr>${kpi(String(arr.length), T.arr)}${kpi(String(dep.length), T.dep)}${kpi(String(nClean), T.cln)}</tr></table>
<p style="margin:0 0 4px"><b>${T.money}:</b> ${esc(money)}</p>
<p style="margin:0 0 14px"><b>${T.bal}:</b> ${n0(bill.balance)} credite · ${bill.days_left == null ? "—" : Math.max(0, bill.days_left) + " " + T.days}</p>
<b>${T.arr}</b>${list(arr.map((b: any) => li(b, b.date)), T.none)}
<b>${T.dep}</b>${list(dep.map((b: any) => li(b, endOf(b))), T.none)}
<b>${T.unpaid}</b>${list(unpaid.map((x: any) => `<li><b>${esc(dm(x.b.date))}</b> · ${esc(x.b.apt)} · ${esc(x.b.guest || "—")} · ${n0(x.left)} €</li>`), T.none)}`;
  };
  return {
    subject: `${org.name} · ${weekly ? "Raport săptămânal / Отчёт за неделю" : "Raport zilnic / Отчёт за день"} · ${per}`,
    ro: { title: `${weekly ? "Săptămâna" : "Ziua"} ${per}`, body: body("ro") },
    ru: { title: `${weekly ? "Неделя" : "День"} ${per}`, body: body("ru") },
    url: orgUrl(org.code),
    stats: { arr: arr.length, dep: dep.length, clean: nClean, unpaid: unpaid.length },
  };
}

export async function runOwnerReports(env: Env, db: D1Database, layout: (ro: any, ru: any, btn?: any) => string, force?: { orgId: string; to?: string }) {
  const t = localToday();
  if (!force && localHour() < 8) return 0;
  const isMon = new Date(t + "T12:00:00Z").getUTCDay() === 1;
  let n = 0;
  const orgs = force ? await all(db, "SELECT o.*, (SELECT data FROM app_config c WHERE c.org_id = o.id) AS cfg FROM orgs o WHERE o.id = ?", force.orgId)
    : await all(db, "SELECT o.*, (SELECT data FROM app_config c WHERE c.org_id = o.id) AS cfg FROM orgs o WHERE o.status = 'active'");
  for (const o of orgs) {
    let cfg: any = {}; try { cfg = JSON.parse(o.cfg || "{}"); } catch {}
    const r = cfg.ownerReport || {}, freq = r.freq === "weekly" ? "weekly" : r.freq === "daily" ? "daily" : force ? "daily" : "";
    if (!freq || (!force && freq === "weekly" && !isMon)) continue;
    const to = force?.to || String(r.to || "").trim() || (await orgEmail(db, o.id)); if (!to) continue;
    const m = await buildOwnerReport(db, o, cfg, freq, t);
    const html = layout(m.ro, m.ru, { url: m.url, ro: "Deschide Espace", ru: "Открыть Espace" });
    await sendMail(env, db, { to, subject: m.subject, html, kind: "owner_report", orgId: o.id, key: force ? undefined : `orep:${o.id}:${freq}:${t}` });
    n++;
  }
  return n;
}
