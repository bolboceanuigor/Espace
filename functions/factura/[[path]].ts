// Printable guest invoice: /factura/<token>. Per-company seller (not the platform /f/ page).
interface Env { DB: D1Database }

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const dmy = (d: string) => (d && d.length >= 10 ? d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(0, 4) : "");
const money = (n: number) => { const [i, f] = (Math.round(n * 100) / 100).toFixed(2).split("."); return i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "," + f; };

const T: Record<string, any> = {
  ro: {
    title: "Factură / Cont de plată", issued: "Data emiterii", due: "Scadența", stay: "Sejur",
    seller: "Furnizor", buyer: "Cumpărător", name: "Denumire", qty: "Cant.", price: "Preț", sum: "Suma",
    net: "Fără TVA", vat: "TVA", total: "Total de plată", words: "Suma în litere",
    noVat: "Furnizorul nu este înregistrat ca plătitor de TVA.",
    payNote: (n: string) => `În destinația plății indicați: „Plata conform facturii ${n}”.`,
    pdf: "Descarcă PDF / Printează", paid: "Achitată", void: "Anulată", missing: "Factura nu există",
    cur: { MDL: "lei", EUR: "EUR", USD: "USD" },
  },
  ru: {
    title: "Счёт / Счёт на оплату", issued: "Дата выставления", due: "Оплатить до", stay: "Проживание",
    seller: "Поставщик", buyer: "Покупатель", name: "Наименование", qty: "Кол.", price: "Цена", sum: "Сумма",
    net: "Без НДС", vat: "НДС", total: "Итого к оплате", words: "Сумма прописью",
    noVat: "Поставщик не является плательщиком НДС.",
    payNote: (n: string) => `В назначении платежа укажите: «Оплата по счёту ${n}».`,
    pdf: "Скачать PDF / Печать", paid: "Оплачен", void: "Отменён", missing: "Счёт не найден",
    cur: { MDL: "лей", EUR: "EUR", USD: "USD" },
  },
  en: {
    title: "Invoice", issued: "Issue date", due: "Due date", stay: "Stay",
    seller: "Seller", buyer: "Buyer", name: "Description", qty: "Qty", price: "Price", sum: "Amount",
    net: "Net", vat: "VAT", total: "Total due", words: "Amount in words",
    noVat: "The seller is not VAT-registered.",
    payNote: (n: string) => `Payment reference: invoice ${n}.`,
    pdf: "Download PDF / Print", paid: "Paid", void: "Cancelled", missing: "Invoice not found",
    cur: { MDL: "MDL", EUR: "EUR", USD: "USD" },
  },
};

const U = ["", "unu", "doi", "trei", "patru", "cinci", "șase", "șapte", "opt", "nouă", "zece", "unsprezece", "doisprezece", "treisprezece", "paisprezece", "cincisprezece", "șaisprezece", "șaptesprezece", "optsprezece", "nouăsprezece"];
const TT = ["", "", "douăzeci", "treizeci", "patruzeci", "cincizeci", "șaizeci", "șaptezeci", "optzeci", "nouăzeci"];
function under1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100, out: string[] = [];
  if (h) out.push(h === 1 ? "o sută" : (h === 2 ? "două" : U[h]) + " sute");
  if (r) out.push(r < 20 ? U[r] : TT[Math.floor(r / 10)] + (r % 10 ? " și " + U[r % 10] : ""));
  return out.join(" ");
}
function wordsRo(n: number): string {
  n = Math.floor(n);
  if (n === 0) return "zero";
  const th = Math.floor(n / 1000), rest = n % 1000, out: string[] = [];
  if (th) out.push(th === 1 ? "o mie" : (th === 2 ? "două" : under1000(th)) + (th % 100 >= 20 || th >= 100 ? " de mii" : " mii"));
  if (rest) out.push(under1000(rest));
  return out.join(" ");
}

export const onRequest: PagesFunction<Env> = async ({ params, env }) => {
  const token = String(([] as string[]).concat((params as any).path || [])[0] || "");
  if (!/^[a-z0-9]{10,24}$/.test(token)) return new Response("not found", { status: 404 });
  const inv: any = await env.DB.prepare("SELECT * FROM guest_invoices WHERE token = ?").bind(token).first();
  if (!inv) return new Response("Factura nu există", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  let s: any = {}, b: any = {}, lines: any[] = [];
  try { s = JSON.parse(inv.seller || "{}"); } catch {}
  try { b = JSON.parse(inv.buyer || "{}"); } catch {}
  try { lines = JSON.parse(inv.lines || "[]") || []; } catch {}
  const lang = T[inv.lang] ? inv.lang : "ro", t = T[lang];
  const vat = !!inv.vat, rate = Number(inv.vat_rate) || 20;
  const total = Number(inv.amount) || 0, net = vat ? total / (1 + rate / 100) : total, tax = total - net;
  const cur = t.cur[inv.currency] || inv.currency || "lei";
  const lei = Math.floor(total), bani = Math.round((total - lei) * 100);
  const status = inv.status === "paid" ? `<div class="stamp ok">${esc(t.paid)} ${esc(dmy(inv.paid_at))}</div>` : inv.status === "void" ? `<div class="stamp void">${esc(t.void)}</div>` : "";
  const party = (title: string, x: any, name: string) => `<div class="party"><h3>${esc(title)}</h3><b>${esc(name)}</b>
    ${x.idno ? `<div>IDNO: ${esc(x.idno)}</div>` : ""}${x.vat_code ? `<div>VAT: ${esc(x.vat_code)}</div>` : ""}${x.address ? `<div>${esc(x.address)}</div>` : ""}
    ${x.bank ? `<div>${esc(x.bank)}${x.bic ? ", " + esc(x.bic) : ""}</div>` : ""}${x.iban ? `<div>IBAN: ${esc(x.iban)}</div>` : ""}
    ${x.email ? `<div>${esc(x.email)}</div>` : ""}${x.phone ? `<div>${esc(x.phone)}</div>` : ""}</div>`;
  const rows = (lines.length ? lines : [{ name: t.stay, qty: 1, price: total, sum: total }]).map((L: any) =>
    `<tr><td>${esc(L.name)}</td><td class="r">${esc(money(L.qty || 1))}</td><td class="r">${esc(money(L.price || 0))}</td><td class="r">${esc(money(L.sum || 0))}</td></tr>`).join("");
  const wordsLine = lang === "ro" && inv.currency === "MDL"
    ? `${esc(t.words)}: ${esc(wordsRo(lei))} lei${bani ? " " + bani + " bani" : " 00 bani"}.`
    : `${esc(t.words)}: ${esc(money(total))} ${esc(cur)}.`;
  const html = `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(t.title)} ${esc(inv.number)}</title><link rel="icon" href="/icon.svg">
<style>
*{box-sizing:border-box}body{margin:0;background:#eef0f5;color:#14162e;font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.page{max-width:820px;margin:24px auto;background:#fff;padding:44px 48px;border-radius:12px;box-shadow:0 10px 30px -15px rgba(20,22,46,.3);position:relative}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:2px solid #14162e;padding-bottom:18px}
.top h1{margin:0;font-size:26px;letter-spacing:-.02em}.top .n{font-size:15px;color:#5b5f7a;margin-top:4px}
.meta{display:grid;grid-template-columns:repeat(2,auto);gap:4px 26px;margin:18px 0 22px;font-size:13.5px}.meta span{color:#5b5f7a}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:24px}
.party h3{margin:0 0 6px;font-size:12px;color:#5b5f7a;font-weight:600}.party b{font-size:15px;display:block;margin-bottom:2px}
table{width:100%;border-collapse:collapse;margin-top:6px}th{text-align:left;font-size:12px;color:#5b5f7a;font-weight:600;border-bottom:1px solid #d5d8e3;padding:8px 6px}
td{padding:10px 6px;border-bottom:1px solid #eceef4;vertical-align:top}td.r,th.r{text-align:right;white-space:nowrap}
.tot{margin-left:auto;width:280px;margin-top:14px}.tot div{display:flex;justify-content:space-between;padding:4px 6px}.tot .g{border-top:2px solid #14162e;font-weight:800;font-size:17px;margin-top:4px;padding-top:8px}
.words{margin-top:14px;color:#5b5f7a}.note{margin-top:22px;padding:12px 14px;background:#f6f7fb;border-radius:8px;font-size:13px}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:46px;font-size:13px;color:#5b5f7a}.sign div{border-top:1px solid #9a9db0;padding-top:6px}
.stamp{position:absolute;top:120px;right:48px;transform:rotate(-8deg);border:3px solid;border-radius:10px;padding:6px 14px;font-weight:800;font-size:18px}
.stamp.ok{color:#1d7a3a}.stamp.void{color:#b42318}
.bar{max-width:820px;margin:16px auto 0;display:flex;gap:10px;justify-content:flex-end;padding:0 4px}
.bar button{font:inherit;font-weight:700;border:0;border-radius:999px;padding:10px 18px;background:#202248;color:#fff;cursor:pointer}
@media (max-width:640px){.page{padding:24px 18px;margin:0;border-radius:0}.parties{grid-template-columns:1fr}.meta{grid-template-columns:1fr 1fr}.stamp{top:16px;right:16px;font-size:14px}}
@media print{body{background:#fff}.page{box-shadow:none;margin:0;max-width:none;padding:0}.bar{display:none}@page{margin:16mm}}
</style></head><body>
<div class="bar"><button onclick="print()">${esc(t.pdf)}</button></div>
<div class="page">${status}
  <div class="top"><div><h1>${esc(t.title)}</h1><div class="n">Nr. ${esc(inv.number)}</div></div><div style="font-weight:800;font-size:17px">${esc(s.name || "")}</div></div>
  <div class="meta"><span>${esc(t.issued)}</span><span>${esc(t.due)}</span><b>${esc(dmy(inv.issued_at))}</b><b>${esc(dmy(inv.due_at))}</b></div>
  <div class="parties">${party(t.seller, s, s.name || "")}${party(t.buyer, b, b.name || "")}</div>
  <table><thead><tr><th>${esc(t.name)}</th><th class="r">${esc(t.qty)}</th><th class="r">${esc(t.price)}</th><th class="r">${esc(t.sum)}</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="tot">${vat ? `<div><span>${esc(t.net)}</span><span>${esc(money(net))}</span></div><div><span>${esc(t.vat)} ${rate}%</span><span>${esc(money(tax))}</span></div>` : ""}<div class="g"><span>${esc(t.total)}</span><span>${esc(money(total))} ${esc(cur)}</span></div></div>
  <div class="words">${wordsLine}${vat ? "" : " " + esc(t.noVat)}</div>
  <div class="note">${esc(t.payNote(inv.number))}${inv.note ? "<br>" + esc(inv.note) : ""}${s.footer ? "<br>" + esc(s.footer) : ""}</div>
  <div class="sign"><div>${esc(t.seller)}</div><div>${esc(t.buyer)}</div></div>
</div></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
};
