// espace.md — transactional email through Resend (https://resend.com).
// Without RESEND_API_KEY nothing is sent: each email is still recorded in the `emails` table with status 'skipped',
// so the admin panel shows what would have gone out.
import { type Env, all, one, run, uuid, today, addDays, billingOf } from "./core";
import { stayGuideUrl } from "./stay";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const dmy = (d: string) => (d && d.length >= 10 ? d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(0, 4) : "");
export const orgUrl = (slug: string) => `https://${slug}.espace.md/`;

// one bilingual layout: Romanian first, Russian under it
export function layout(ro: { title: string; body: string }, ru: { title: string; body: string }, button?: { url: string; ro: string; ru: string }) {
  const btn = (t: string) => button ? `<p style="margin:22px 0"><a href="${esc(button.url)}" style="background:#202248;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;display:inline-block">${esc(t)}</a></p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f6f9;font-family:Arial,Helvetica,sans-serif;color:#14162e">
<div style="max-width:560px;margin:0 auto;padding:28px 16px">
<div style="font-weight:800;font-size:18px;margin-bottom:18px">espace.md</div>
<div style="background:#fff;border-radius:14px;padding:26px 24px;line-height:1.55;font-size:15px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(ro.title)}</h1>${ro.body}${btn(button?.ro || "")}
<hr style="border:0;border-top:1px solid #e4e6ee;margin:24px 0">
<h2 style="font-size:17px;margin:0 0 10px;color:#4c5068">${esc(ru.title)}</h2><div style="color:#4c5068">${ru.body}</div>${btn(button?.ru || "")}
</div>
<p style="font-size:12.5px;color:#868aa1;margin-top:16px">espace.md · Chișinău · Ai primit acest email pentru că ai un cont pe espace.md. / Вы получили это письмо, потому что у вас есть аккаунт на espace.md.</p>
</div></body></html>`;
}

// emails to GUESTS: the company's name on top, one language (the guest's), no "you have an account" footer.
// Without a known language: Romanian and Russian, one under the other, as before.
type GP = { title: string; body: string };
const GL = (l?: string) => (l === "ru" || l === "ro" || l === "en" ? l : "");
export const bLang = (b: any) => { try { const x = typeof b?.extra === "string" ? JSON.parse(b.extra || "{}") : (b?.extra || {}); return String(x.lang || ""); } catch { return ""; } };
export const guestT = (lang: string | undefined, t: { ro: string; ru: string; en: string }) => t[(GL(lang) || "ro") as "ro"];
export function guestLayout(org: string, lang: string | undefined, p: { ro: GP; ru: GP; en: GP }, button?: { url: string; ro: string; ru: string; en: string }) {
  const l = GL(lang);
  const btn = (t: string) => button ? `<p style="margin:22px 0"><a href="${esc(button.url)}" style="background:#0666EB;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;display:inline-block">${esc(t)}</a></p>` : "";
  const foot = { ro: `Trimis de ${esc(org)} prin espace.md.`, ru: `Отправлено компанией ${esc(org)} через espace.md.`, en: `Sent by ${esc(org)} via espace.md.` };
  const block = (x: GP, b: string, muted = false) => `<h1 style="font-size:${muted ? 17 : 20}px;margin:0 0 12px${muted ? ";color:#4c5068" : ""}">${esc(x.title)}</h1><div${muted ? ' style="color:#4c5068"' : ""}>${x.body}</div>${btn(b)}`;
  const inner = l ? block(p[l], button ? button[l] : "") : block(p.ro, button?.ro || "") + `<hr style="border:0;border-top:1px solid #e4e6ee;margin:24px 0">` + block(p.ru, button?.ru || "", true);
  return `<!doctype html><html lang="${l || "ro"}"><body style="margin:0;background:#f5f6f9;font-family:Arial,Helvetica,sans-serif;color:#14162e">
<div style="max-width:560px;margin:0 auto;padding:28px 16px">
<div style="font-weight:800;font-size:18px;margin-bottom:18px">${esc(org)}</div>
<div style="background:#fff;border-radius:14px;padding:26px 24px;line-height:1.55;font-size:15px">${inner}</div>
<p style="font-size:12.5px;color:#868aa1;margin-top:16px">${l ? foot[l] : foot.ro + " / " + foot.ru}</p>
</div></body></html>`;
}

export async function sendMail(env: Env, db: D1Database, m: { to: string; subject: string; html: string; kind: string; orgId?: string; key?: string }) {
  // `key` makes an email go out once (e.g. "trial3:<org>"), even if the daily job runs twice
  if (m.key && (await one(db, "SELECT 1 AS x FROM emails WHERE dedupe = ?", m.key).catch(() => null))) return "duplicate";
  let status = "skipped", detail = "";
  if (env.RESEND_API_KEY && m.to) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ from: env.MAIL_FROM || "espace.md <noreply@espace.md>", to: [m.to], subject: m.subject, html: m.html, reply_to: env.MAIL_REPLY_TO || undefined }),
      });
      status = r.ok ? "sent" : "failed";
      if (!r.ok) detail = (await r.text()).slice(0, 300);
    } catch (e: any) { status = "failed"; detail = String(e?.message || e).slice(0, 300); }
  }
  await run(db, "INSERT INTO emails(id, org_id, to_addr, subject, kind, status, detail, dedupe) VALUES (?,?,?,?,?,?,?,?)",
    uuid(), m.orgId || "", m.to, m.subject, m.kind, status, detail, m.key || null).catch(() => {});
  return status;
}

// where a company's emails go: the billing email if set, else the owner's
export async function orgEmail(db: D1Database, orgId: string) {
  const o = await one(db, "SELECT billing FROM orgs WHERE id = ?", orgId);
  try { const b = JSON.parse(o?.billing || "{}"); if (b.email) return b.email as string; } catch {}
  const u = await one(db, "SELECT u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.role = 'owner' ORDER BY m.created_at LIMIT 1", orgId);
  return (u?.email as string) || "";
}

// a message from the platform owner to the companies (admin → "Mesaj către clienți"); plain text, one or two languages
function textHtml(t: string) {
  return t.trim().split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}
export function broadcastMail(subject: string, ro: string, ru: string) {
  if (ru.trim()) return { subject, html: layout({ title: subject, body: textHtml(ro) }, { title: subject, body: textHtml(ru) }) };
  return { subject, html: `<!doctype html><html><body style="margin:0;background:#f5f6f9;font-family:Arial,Helvetica,sans-serif;color:#14162e">
<div style="max-width:560px;margin:0 auto;padding:28px 16px">
<div style="font-weight:800;font-size:18px;margin-bottom:18px">espace.md</div>
<div style="background:#fff;border-radius:14px;padding:26px 24px;line-height:1.55;font-size:15px"><h1 style="font-size:20px;margin:0 0 12px">${esc(subject)}</h1>${textHtml(ro)}</div>
<p style="font-size:12.5px;color:#868aa1;margin-top:16px">espace.md · Chișinău · Ai primit acest email pentru că ai un cont pe espace.md.</p>
</div></body></html>` };
}

export const mails = {
  welcome: (name: string, org: string, slug: string, url: string) => ({
    subject: `Confirmă emailul și alege parola — ${org}`,
    html: layout(
      { title: `Bine ai venit, ${name}!`, body: `<p>Compania <b>${esc(org)}</b> e creată, la adresa <b>${esc(slug)}.espace.md</b>. Acolo intrați tu, managerii și menajerele.</p><p>Ca să intri, confirmă că emailul e al tău și alege o parolă — butonul de mai jos. Linkul e valabil <b>3 zile</b>.</p><p>Ai <b>14 zile gratuit</b>. Ai întrebări? Răspunde la acest email.</p>` },
      { title: `Добро пожаловать, ${name}!`, body: `<p>Компания <b>${esc(org)}</b> создана, адрес — <b>${esc(slug)}.espace.md</b>. Подтвердите email и задайте пароль кнопкой ниже — ссылка действует <b>3 дня</b>. У вас <b>14 дней бесплатно</b>.</p>` },
      { url, ro: "Confirmă și alege parola", ru: "Подтвердить и задать пароль" }),
  }),
  setPassword: (email: string, url: string) => ({
    subject: `Alege parola pentru espace.md · ${new Date().toLocaleTimeString("ro-RO", { timeZone: "Europe/Chisinau", hour: "2-digit", minute: "2-digit" })}`,
    html: layout(
      { title: "Alege parola", body: `<p>Contul <b>${esc(email)}</b> încă nu are parolă. Alege una cu butonul de mai jos — linkul e valabil <b>3 zile</b> și merge o singură dată.</p>` },
      { title: "Задайте пароль", body: `<p>У аккаунта <b>${esc(email)}</b> ещё нет пароля. Задайте его кнопкой ниже — ссылка действует <b>3 дня</b> и работает один раз.</p>` },
      { url, ro: "Alege parola", ru: "Задать пароль" }),
  }),
  invite: (by: string, org: string, slug: string, url: string, needsPassword: boolean) => ({
    subject: `${by} te-a adăugat în ${org} pe espace.md`,
    html: layout(
      { title: `Ai acces la ${esc(org)}`, body: `<p><b>${esc(by)}</b> te-a adăugat în echipa <b>${esc(org)}</b> pe espace.md (adresa <b>${esc(slug)}.espace.md</b>).</p><p>${needsPassword ? "Alege-ți parola cu butonul de mai jos — linkul e valabil <b>3 zile</b>. Apoi intri cu acest email și parola ta." : "Intri cu emailul și parola pe care le ai deja."}</p>` },
      { title: `Доступ к ${esc(org)}`, body: `<p><b>${esc(by)}</b> добавил(а) вас в команду <b>${esc(org)}</b> на espace.md (<b>${esc(slug)}.espace.md</b>). ${needsPassword ? "Задайте пароль кнопкой ниже — ссылка действует 3 дня." : "Входите с вашим email и паролем."}</p>` },
      { url, ro: needsPassword ? "Alege parola" : "Deschide compania", ru: needsPassword ? "Задать пароль" : "Открыть компанию" }),
  }),
  // an apartment owner gets their own view: occupancy, income, payout and statements of their apartments
  inviteProp: (org: string, slug: string, url: string, needsPassword: boolean) => ({
    subject: `${org}: apartamentele dumneavoastră pe espace.md`,
    html: layout(
      { title: "Vedeți apartamentele dumneavoastră online", body: `<p><b>${esc(org)}</b> vă administrează apartamentele și v-a dat acces la <b>${esc(slug)}.espace.md</b>: calendarul ocupării, veniturile, cheltuielile, suma de plată și rapoartele lunare — doar pentru apartamentele dumneavoastră.</p><p>${needsPassword ? "Alegeți parola cu butonul de mai jos (linkul e valabil <b>3 zile</b>), apoi intrați cu acest email și parola." : "Intrați cu emailul și parola pe care le aveți deja."}</p>` },
      { title: "Ваши квартиры онлайн", body: `<p><b>${esc(org)}</b> открыл вам доступ на <b>${esc(slug)}.espace.md</b>: загрузка, доход, расходы, сумма к выплате и отчёты — только по вашим квартирам. ${needsPassword ? "Задайте пароль кнопкой ниже — ссылка действует 3 дня." : "Входите с вашим email и паролем."}</p>` },
      { url, ro: needsPassword ? "Alege parola" : "Deschide", ru: needsPassword ? "Задать пароль" : "Открыть" }),
  }),
  reset: (url: string) => ({
    // the time in the subject keeps each request a separate email (Gmail would otherwise stack them and the older, used link is easy to click)
    subject: `Resetarea parolei espace.md · ${new Date().toLocaleTimeString("ro-RO", { timeZone: "Europe/Chisinau", hour: "2-digit", minute: "2-digit" })}`,
    html: layout(
      { title: "Resetează parola", body: `<p>Cineva (probabil tu) a cerut o parolă nouă pentru contul tău espace.md. Linkul e valabil <b>1 oră</b> și merge o singură dată. Dacă ai cerut de mai multe ori, folosește emailul cel mai nou.</p><p>Dacă nu ai cerut tu, ignoră acest email — parola rămâne aceeași.</p>` },
      { title: "Сброс пароля", body: `<p>Кто-то (скорее всего вы) запросил новый пароль для аккаунта espace.md. Ссылка действует <b>1 час</b>. Если это были не вы — просто проигнорируйте письмо.</p>` },
      { url, ro: "Alege o parolă nouă", ru: "Задать новый пароль" }),
  }),
  emailChanged: (org: string, email: string, url: string) => ({
    subject: `Contul tău espace.md — ${org}`,
    html: layout(
      { title: "Alege parola", body: `<p>Administratorul espace.md a setat <b>${esc(email)}</b> ca adresa ta de intrare pentru <b>${esc(org)}</b>. Alege o parolă — linkul e valabil <b>24 de ore</b> și merge o singură dată.</p><p>După asta intri cu acest email și parola nouă.</p>` },
      { title: "Задайте пароль", body: `<p>Администратор espace.md указал <b>${esc(email)}</b> как ваш email для входа в <b>${esc(org)}</b>. Задайте пароль — ссылка действует <b>24 часа</b> и работает один раз.</p>` },
      { url, ro: "Alege parola", ru: "Задать пароль" }),
  }),
  emailChangedOld: (org: string, email: string) => ({
    subject: `Adresa de intrare espace.md a fost schimbată — ${org}`,
    html: layout(
      { title: "Emailul de intrare s-a schimbat", body: `<p>Pentru <b>${esc(org)}</b> intrarea în espace.md se face de acum cu <b>${esc(email)}</b>, nu cu această adresă. Dacă nu ai cerut tu schimbarea, răspunde la acest email.</p>` },
      { title: "Email для входа изменён", body: `<p>Для <b>${esc(org)}</b> вход в espace.md теперь по адресу <b>${esc(email)}</b>, а не по этому. Если вы этого не просили — ответьте на это письмо.</p>` }),
  }),
  // direct booking page: a guest's request, to the company and to the guest; then the company's answer
  requestNew: (org: string, slug: string, r: any) => ({
    subject: `Cerere de rezervare: ${r.apt} · ${dmy(r.date)} · ${r.nights} n.`,
    html: layout(
      { title: "Cerere nouă de pe pagina de rezervare", body: `<p><b>${esc(r.name)}</b> vrea <b>${esc(r.apt)}</b> de pe <b>${dmy(r.date)}</b>, ${r.nights} ${r.nights === 1 ? "noapte" : "nopți"}, ${r.pax} pers. — ${lei2(r.price)} ${curL(r.cur)}.</p><p>${r.phone ? "Telefon: <b>" + esc(r.phone) + "</b><br>" : ""}${r.email ? "Email: " + esc(r.email) + "<br>" : ""}${r.msg ? "Mesaj: " + esc(r.msg) : ""}</p><p>Datele sunt rezervate provizoriu în calendar. Confirmă sau respinge cererea în aplicație — oaspetele primește răspunsul pe email.</p>` },
      { title: "Новая заявка со страницы бронирования", body: `<p><b>${esc(r.name)}</b> — <b>${esc(r.apt)}</b>, с ${dmy(r.date)}, ${r.nights} н., ${r.pax} чел. Подтвердите или отклоните заявку в приложении.</p>` },
      { url: orgUrl(slug), ro: "Deschide aplicația", ru: "Открыть приложение" }),
  }),
  requestGot: (org: string, r: any, lang?: string) => {
    const n = r.nights, tot = `${lei2(r.price)} ${curL(r.cur)}`, ph = r.phone ? esc(r.phone) : "";
    return {
      subject: guestT(lang, { ro: `${org}: am primit cererea ta (${dmy(r.date)})`, ru: `${org}: заявка получена (${dmy(r.date)})`, en: `${org}: we received your request (${dmy(r.date)})` }),
      html: guestLayout(org, lang, {
        ro: { title: "Cererea a fost trimisă", body: `<p>Mulțumim! <b>${esc(org)}</b> a primit cererea pentru <b>${esc(r.apt)}</b>, de pe <b>${dmy(r.date)}</b>, ${n} ${n === 1 ? "noapte" : "nopți"}, ${r.pax} pers. Total: <b>${tot}</b>.</p><p>Rezervarea devine fermă după confirmare — primești un email.${ph ? " Telefon: " + ph + "." : ""}</p>` },
        ru: { title: "Заявка отправлена", body: `<p>Спасибо! <b>${esc(org)}</b> получил заявку: <b>${esc(r.apt)}</b>, с <b>${dmy(r.date)}</b>, ночей: ${n}, гостей: ${r.pax}. Итого: <b>${tot}</b>.</p><p>Бронь станет окончательной после подтверждения — придёт письмо.${ph ? " Телефон: " + ph + "." : ""}</p>` },
        en: { title: "Your request was sent", body: `<p>Thank you! <b>${esc(org)}</b> received your request for <b>${esc(r.apt)}</b> from <b>${dmy(r.date)}</b>, ${n} ${n === 1 ? "night" : "nights"}, ${r.pax} guests. Total: <b>${tot}</b>.</p><p>The booking is final once confirmed — you will get an email.${ph ? " Phone: " + ph + "." : ""}</p>` },
      }),
    };
  },
  requestAnswer: (org: string, yes: boolean, r: any, lang?: string) => {
    const n = r.nights, tot = `${lei2(r.price)} ${curL(r.cur)}`, note = r.note ? "<br>" + esc(r.note) : "", ph = r.phone ? esc(r.phone) : "";
    const guide = (t: string) => r.guide ? `<p>${t}: <a href="${esc(r.guide)}">${esc(r.guide)}</a></p>` : "";
    return {
      subject: yes ? guestT(lang, { ro: `${org}: rezervarea e confirmată (${dmy(r.date)})`, ru: `${org}: бронь подтверждена (${dmy(r.date)})`, en: `${org}: your booking is confirmed (${dmy(r.date)})` })
        : guestT(lang, { ro: `${org}: datele nu sunt disponibile`, ru: `${org}: даты недоступны`, en: `${org}: the dates are not available` }),
      html: guestLayout(org, lang, yes ? {
        ro: { title: "Rezervarea e confirmată", body: `<p><b>${esc(r.apt)}</b>, de pe <b>${dmy(r.date)}</b>, ${n} ${n === 1 ? "noapte" : "nopți"}. Total: <b>${tot}</b>.${note}</p><p>${ph ? "Telefon: <b>" + ph + "</b>. " : ""}Vă așteptăm!</p>${guide("Ghidul oaspetelui (cum ajungeți, Wi-Fi, reguli)")}` },
        ru: { title: "Бронь подтверждена", body: `<p><b>${esc(r.apt)}</b>, с <b>${dmy(r.date)}</b>, ночей: ${n}. Итого: <b>${tot}</b>.${note}</p><p>${ph ? "Телефон: <b>" + ph + "</b>. " : ""}Ждём вас!</p>${guide("Гид для гостя (как добраться, Wi-Fi, правила)")}` },
        en: { title: "Your booking is confirmed", body: `<p><b>${esc(r.apt)}</b>, from <b>${dmy(r.date)}</b>, ${n} ${n === 1 ? "night" : "nights"}. Total: <b>${tot}</b>.${note}</p><p>${ph ? "Phone: <b>" + ph + "</b>. " : ""}See you soon!</p>${guide("Guest guide (how to get there, Wi-Fi, rules)")}` },
      } : {
        ro: { title: "Din păcate, datele nu sunt disponibile", body: `<p>${esc(org)} nu poate confirma cererea pentru ${esc(r.apt)} de pe ${dmy(r.date)}.${note} Încercați alte date pe pagina de rezervare.</p>` },
        ru: { title: "К сожалению, даты недоступны", body: `<p>${esc(org)} не может подтвердить заявку на ${esc(r.apt)} с ${dmy(r.date)}.${note} Попробуйте другие даты на странице бронирования.</p>` },
        en: { title: "Sorry, the dates are not available", body: `<p>${esc(org)} cannot confirm the request for ${esc(r.apt)} from ${dmy(r.date)}.${note} Please try other dates on the booking page.</p>` },
      }),
    };
  },
  // the monthly statement for an apartment owner: what was earned, what is paid out, a link to the full statement
  ownerReport: (org: string, r: { name: string; ym: string; pay: number; inc: number; nights: number; url: string }) => {
    const LRO = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
    const LRU = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
    const mi = +r.ym.slice(5, 7) - 1, y = r.ym.slice(0, 4), eur = (n: number) => lei2(n) + " €";
    return {
      subject: `${org}: raportul pentru ${LRO[mi]} ${y}`,
      html: layout(
        { title: `Raportul pe ${LRO[mi]} ${y}`, body: `<p>Bună${r.name ? ", " + esc(r.name) : ""}! <b>${esc(org)}</b> v-a trimis raportul lunar: <b>${r.nights}</b> ${r.nights === 1 ? "noapte ocupată" : "nopți ocupate"}, venit <b>${eur(r.inc)}</b>, de plată către dumneavoastră <b>${eur(r.pay)}</b>.</p><p>În raport găsiți fiecare rezervare, cheltuielile și comisionul.</p>` },
        { title: `Отчёт за ${LRU[mi]} ${y}`, body: `<p>${esc(org)}: занято ночей — ${r.nights}, доход ${eur(r.inc)}, к выплате вам <b>${eur(r.pay)}</b>. В отчёте — каждая бронь, расходы и комиссия.</p>` },
        { url: r.url, ro: "Deschide raportul", ru: "Открыть отчёт" }),
    };
  },
  // the owner was paid for a month
  ownerPaid: (org: string, r: { name: string; ym: string; amount: number; method: string; paidOn: string; url: string }) => {
    const LRO = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
    const LRU = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
    const MRO: any = { bank: "prin transfer", cash: "în numerar", card: "pe card" }, MRU: any = { bank: "переводом", cash: "наличными", card: "на карту" };
    const mi = +r.ym.slice(5, 7) - 1, y = r.ym.slice(0, 4);
    return {
      subject: `${org}: plata pentru ${LRO[mi]} ${y} — ${lei2(r.amount)} €`,
      html: layout(
        { title: `Plata pentru ${LRO[mi]} ${y}`, body: `<p>Bună${r.name ? ", " + esc(r.name) : ""}! <b>${esc(org)}</b> v-a achitat <b>${lei2(r.amount)} €</b> pentru ${LRO[mi]} ${y}, ${MRO[r.method] || ""}, pe ${dmy(r.paidOn)}.</p>` },
        { title: `Выплата за ${LRU[mi]} ${y}`, body: `<p>${esc(org)} выплатил вам <b>${lei2(r.amount)} €</b> за ${LRU[mi]} ${y}, ${MRU[r.method] || ""}, ${dmy(r.paidOn)}.</p>` },
        r.url ? { url: r.url, ro: "Vezi raportul", ru: "Открыть отчёт" } : undefined),
    };
  },
  // a guest gets the link to read and sign the rental contract
  contractLink: (org: string, r: { number: string; apt: string; date: string; nights: number; url: string }, lang?: string) => ({
    subject: guestT(lang, { ro: `${org}: contractul de închiriere nr. ${r.number} — semnați online`, ru: `${org}: договор аренды № ${r.number} — подпишите онлайн`, en: `${org}: rental contract no. ${r.number} — sign online` }),
    html: guestLayout(org, lang, {
      ro: { title: "Contractul de închiriere", body: `<p><b>${esc(org)}</b> vă trimite contractul nr. ${esc(r.number)} pentru <b>${esc(r.apt)}</b>, de pe ${dmy(r.date)}, ${r.nights} ${r.nights === 1 ? "noapte" : "nopți"}. Îl citiți și îl semnați pe telefon, cu degetul.</p>` },
      ru: { title: "Договор аренды", body: `<p><b>${esc(org)}</b> отправляет договор № ${esc(r.number)}: <b>${esc(r.apt)}</b>, с ${dmy(r.date)}, ночей: ${r.nights}. Прочитать и подписать можно с телефона, пальцем.</p>` },
      en: { title: "Rental contract", body: `<p><b>${esc(org)}</b> sends you contract no. ${esc(r.number)} for <b>${esc(r.apt)}</b>, from ${dmy(r.date)}, ${r.nights} ${r.nights === 1 ? "night" : "nights"}. Read it and sign it on your phone with your finger.</p>` },
    }, { url: r.url, ro: "Citește și semnează", ru: "Прочитать и подписать", en: "Read and sign" }),
  }),
  contractSigned: (org: string, r: { number: string; apt: string; date: string; url: string; guest: boolean; name?: string }, lang?: string) => r.guest ? ({
    subject: guestT(lang, { ro: `${org}: contractul nr. ${r.number} e semnat`, ru: `${org}: договор № ${r.number} подписан`, en: `${org}: contract no. ${r.number} is signed` }),
    html: guestLayout(org, lang, {
      ro: { title: "Contractul e semnat", body: `<p>Mulțumim! Contractul nr. ${esc(r.number)} cu <b>${esc(org)}</b> pentru ${esc(r.apt)}, de pe ${dmy(r.date)}, e semnat. Îl puteți deschide oricând, tipări sau salva ca PDF.</p>` },
      ru: { title: "Договор подписан", body: `<p>Спасибо! Договор № ${esc(r.number)} с <b>${esc(org)}</b>: ${esc(r.apt)}, с ${dmy(r.date)} — подписан. Его можно открыть, распечатать или сохранить в PDF.</p>` },
      en: { title: "The contract is signed", body: `<p>Thank you! Contract no. ${esc(r.number)} with <b>${esc(org)}</b> for ${esc(r.apt)}, from ${dmy(r.date)}, is signed. You can open, print or save it as PDF any time.</p>` },
    }, { url: r.url, ro: "Deschide contractul", ru: "Открыть договор", en: "Open the contract" }),
  }) : ({
    subject: `Contract semnat: ${r.apt}, ${dmy(r.date)} — ${r.name || ""}`,
    html: layout(
      { title: "Contract semnat de oaspete", body: `<p><b>${esc(r.name || "")}</b> a semnat contractul nr. ${esc(r.number)} pentru <b>${esc(r.apt)}</b>, de pe ${dmy(r.date)}.</p>` },
      { title: "Гость подписал договор", body: `<p>${esc(r.name || "")} подписал(а) договор № ${esc(r.number)}: ${esc(r.apt)}, ${dmy(r.date)}.</p>` },
      { url: r.url, ro: "Deschide contractul", ru: "Открыть договор" }),
  }),
  // the day before check-in, to a guest who booked on the company's page: time, address, contact, the guest guide
  arrival: (org: string, r: any, lang?: string) => ({
    subject: guestT(lang, { ro: `${org}: vă așteptăm mâine · ${r.apt}`, ru: `${org}: ждём вас завтра · ${r.apt}`, en: `${org}: see you tomorrow · ${r.apt}` }),
    html: guestLayout(org, lang, {
      ro: { title: "Vă așteptăm mâine", body: `<p><b>${esc(r.apt)}</b>, ${dmy(r.date)}${r.cin ? ", check-in de la <b>" + esc(r.cin) + "</b>" : ""}.${r.addr ? "<br>Adresa: <b>" + esc(r.addr) + "</b>" : ""}${r.phone ? "<br>Telefon: <b>" + esc(r.phone) + "</b>" : ""}</p>${r.guide ? "<p>În ghid găsiți cum ajungeți, codurile, Wi-Fi și regulile casei.</p>" : ""}` },
      ru: { title: "Ждём вас завтра", body: `<p><b>${esc(r.apt)}</b>, ${dmy(r.date)}${r.cin ? ", заезд с <b>" + esc(r.cin) + "</b>" : ""}.${r.addr ? "<br>Адрес: <b>" + esc(r.addr) + "</b>" : ""}${r.phone ? "<br>Телефон: <b>" + esc(r.phone) + "</b>" : ""}</p>${r.guide ? "<p>В гиде — как добраться, коды, Wi-Fi и правила дома.</p>" : ""}` },
      en: { title: "See you tomorrow", body: `<p><b>${esc(r.apt)}</b>, ${dmy(r.date)}${r.cin ? ", check-in from <b>" + esc(r.cin) + "</b>" : ""}.${r.addr ? "<br>Address: <b>" + esc(r.addr) + "</b>" : ""}${r.phone ? "<br>Phone: <b>" + esc(r.phone) + "</b>" : ""}</p>${r.guide ? "<p>The guide has directions, door codes, Wi-Fi and house rules.</p>" : ""}` },
    }, r.guide ? { url: r.guide, ro: "Deschide ghidul oaspetelui", ru: "Открыть гид", en: "Open the guest guide" } : undefined),
  }),
  trialEnding: (org: string, slug: string, ends: string, daily: number, apts: number, balance: number) => ({
    subject: `Perioada de probă ${org} se termină pe ${dmy(ends)}`,
    html: layout(
      { title: "Proba se termină în 3 zile", body: `<p>Perioada gratuită pentru <b>${esc(org)}</b> se termină pe <b>${dmy(ends)}</b>.${daily ? ` Apoi, în fiecare zi se scad <b>${lei2(daily)} credite</b> (${apts} ${apts === 1 ? "unitate" : "unități"} × 1 credit). 1 credit = 1 leu.` : ""}${balance > 0 ? ` Ai acum <b>${lei2(balance)} credite</b>.` : " Încă nu ai credite — fără suplinire, după această dată datele rămân, dar nu se mai pot face modificări."}</p><p>Suplinești din aplicație: Meniu → Setări → Abonament.</p>` },
      { title: "Пробный период заканчивается через 3 дня", body: `<p>Бесплатный период для <b>${esc(org)}</b> заканчивается <b>${dmy(ends)}</b>.${daily ? ` Дальше каждый день списывается <b>${lei2(daily)} кредитов</b> (${apts} объектов × 1 кредит). 1 кредит = 1 лей.` : ""}${balance > 0 ? ` Сейчас у вас <b>${lei2(balance)} кредитов</b>.` : " Без пополнения после этой даты данные сохранятся, но изменять их будет нельзя."} Пополнить — в приложении: Меню → Настройки → Подписка.</p>` },
      { url: orgUrl(slug), ro: "Deschide compania", ru: "Открыть компанию" }),
  }),
  lowBalance: (org: string, slug: string, balance: number, days: number) => ({
    subject: `${org}: creditele ajung pentru ${days} ${days === 1 ? "zi" : "zile"}`,
    html: layout(
      { title: "Suplinește creditele", body: `<p>Pe contul <b>${esc(org)}</b> au rămas <b>${lei2(balance)} credite</b> — ajung pentru <b>${days} ${days === 1 ? "zi" : "zile"}</b>. Când se termină, aplicația trece în modul doar vizualizare până la suplinire.</p><p>Suplinești din aplicație: Meniu → Setări → Abonament.</p>` },
      { title: "Пополните кредиты", body: `<p>На счёте <b>${esc(org)}</b> осталось <b>${lei2(balance)} кредитов</b> — хватит на <b>${days}</b> дн. Когда они закончатся, приложение перейдёт в режим просмотра до пополнения. Пополнить — Меню → Настройки → Подписка.</p>` },
      { url: orgUrl(slug), ro: "Deschide compania", ru: "Открыть компанию" }),
  }),
  expired: (org: string, slug: string) => ({
    subject: `${org}: creditele s-au terminat — doar vizualizare`,
    html: layout(
      { title: "Creditele s-au terminat", body: `<p>Creditele de pe contul <b>${esc(org)}</b> s-au terminat. Datele sunt în siguranță și le poți vedea, dar modificările sunt oprite până la suplinire. Ceri factura din aplicație (Meniu → Setări → Abonament) sau răspunde la acest email.</p>` },
      { title: "Кредиты закончились", body: `<p>Кредиты на счёте <b>${esc(org)}</b> закончились. Данные в сохранности и доступны для просмотра, но изменения остановлены до пополнения. Счёт — в приложении (Меню → Настройки → Подписка) или ответьте на это письмо.</p>` },
      { url: orgUrl(slug), ro: "Deschide compania", ru: "Открыть компанию" }),
  }),
  invoice: (org: string, number: string, amount: number, due: string, url: string) => ({
    subject: `Factura ${number} — ${amount} lei — espace.md`,
    html: layout(
      { title: `Factura ${number}`, body: `<p>Pentru <b>${esc(org)}</b>: <b>${amount} lei</b>, scadența <b>${dmy(due)}</b>. În destinația plății indicați numărul facturii.</p>` },
      { title: `Счёт ${number}`, body: `<p>Для <b>${esc(org)}</b>: <b>${amount} лей</b>, оплатить до <b>${dmy(due)}</b>. В назначении платежа укажите номер счёта.</p>` },
      { url, ro: "Deschide factura (PDF)", ru: "Открыть счёт (PDF)" }),
  }),
  // a company sends a guest invoice (stay payment), separate from platform credit invoices
  guestInvoice: (org: string, r: { number: string; amount: number; cur: string; due: string; url: string; apt: string; date: string }, lang?: string) => ({
    subject: guestT(lang, { ro: `${org}: factura ${r.number} — ${r.amount} ${r.cur}`, ru: `${org}: счёт ${r.number} — ${r.amount} ${r.cur}`, en: `${org}: invoice ${r.number} — ${r.amount} ${r.cur}` }),
    html: guestLayout(org, lang, {
      ro: { title: `Factura ${r.number}`, body: `<p><b>${esc(org)}</b> vă trimite factura pentru <b>${esc(r.apt)}</b> (de pe ${dmy(r.date)}): <b>${r.amount} ${esc(r.cur)}</b>, scadența <b>${dmy(r.due)}</b>. O deschideți, tipăriți sau salvați ca PDF.</p>` },
      ru: { title: `Счёт ${r.number}`, body: `<p><b>${esc(org)}</b> отправляет счёт за <b>${esc(r.apt)}</b> (с ${dmy(r.date)}): <b>${r.amount} ${esc(r.cur)}</b>, оплатить до <b>${dmy(r.due)}</b>. Можно открыть, распечатать или сохранить в PDF.</p>` },
      en: { title: `Invoice ${r.number}`, body: `<p><b>${esc(org)}</b> sends you the invoice for <b>${esc(r.apt)}</b> (from ${dmy(r.date)}): <b>${r.amount} ${esc(r.cur)}</b>, due <b>${dmy(r.due)}</b>. Open, print or save it as PDF.</p>` },
    }, { url: r.url, ro: "Deschide factura (PDF)", ru: "Открыть счёт (PDF)", en: "Open the invoice (PDF)" }),
  }),
  invoiceDue: (org: string, number: string, amount: number, due: string, url: string, overdue: boolean) => ({
    subject: overdue ? `Factura ${number} e scadentă azi` : `Factura ${number}: scadența pe ${dmy(due)}`,
    html: layout(
      { title: overdue ? "Factura e scadentă azi" : "Amintire: factura e scadentă curând", body: `<p>Factura <b>${esc(number)}</b> pentru <b>${esc(org)}</b>, <b>${amount} lei</b>, are scadența pe <b>${dmy(due)}</b>. Dacă ai plătit deja, ignoră acest mesaj.</p>` },
      { title: overdue ? "Срок оплаты счёта — сегодня" : "Напоминание об оплате", body: `<p>Счёт <b>${esc(number)}</b> для <b>${esc(org)}</b>, <b>${amount} лей</b>, оплатить до <b>${dmy(due)}</b>. Если уже оплатили — проигнорируйте письмо.</p>` },
      { url, ro: "Deschide factura", ru: "Открыть счёт" }),
  }),
  paid: (org: string, amount: number, balance: number, until: string) => ({
    subject: `Plată primită — ${org}: ${lei2(balance)} credite`,
    html: layout(
      { title: "Mulțumim, plata a ajuns", body: `<p>Am adăugat <b>${lei2(amount)} credite</b> pe contul <b>${esc(org)}</b> (1 credit = 1 leu). Ai acum <b>${lei2(balance)} credite</b>${until ? `, ajung aproximativ până la <b>${dmy(until)}</b> la numărul actual de unități` : ""}.</p>` },
      { title: "Спасибо, оплата получена", body: `<p>Зачислили <b>${lei2(amount)} кредитов</b> на счёт <b>${esc(org)}</b> (1 кредит = 1 лей). Теперь у вас <b>${lei2(balance)} кредитов</b>${until ? `, хватит примерно до <b>${dmy(until)}</b> при текущем числе объектов` : ""}.</p>` }),
  }),
};
const curL = (c: string) => ({ EUR: "€", USD: "$", MDL: "lei" } as any)[c] || c;
const lei2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");

// once a day: trial ending in 3 days, subscription just ended, invoice due in 3 days / today
export async function dailyMail(env: Env, db: D1Database) {
  const t = today(), k = "mail-daily-" + t;
  const res = await run(db, "INSERT OR IGNORE INTO sys_state(k, v) VALUES (?, '1')", k);
  if (!res.meta.changes) return 0;
  let n = 0;
  const orgs = await all(db, "SELECT o.*, (SELECT data FROM app_config c WHERE c.org_id = o.id) AS cfg FROM orgs o WHERE o.status = 'active'");
  for (const o of orgs) {
    const b = await billingOf(db, o);
    const to = await orgEmail(db, o.id); if (!to) continue;
    const last = await one(db, "SELECT id FROM payments WHERE org_id = ? ORDER BY created_at DESC LIMIT 1", o.id);
    if (o.trial_ends === addDays(t, 3)) { await sendMail(env, db, { to, ...mails.trialEnding(o.name, o.code, o.trial_ends, b.daily, b.apts, b.balance), kind: "trial_ending", orgId: o.id, key: `trial3:${o.id}:${o.trial_ends}` }); n++; }
    // balance running low (once per top-up), after the trial
    if (!b.expired && !b.in_trial && b.daily && b.days_left <= 3) { await sendMail(env, db, { to, ...mails.lowBalance(o.name, o.code, b.balance, Math.max(0, b.days_left)), kind: "low_balance", orgId: o.id, key: `low:${o.id}:${last?.id || "none"}` }); n++; }
    // just ran out: yesterday was the last covered day
    if (b.expired && b.covered_until === addDays(t, -1)) { await sendMail(env, db, { to, ...mails.expired(o.name, o.code), kind: "expired", orgId: o.id, key: `expired:${o.id}:${b.covered_until}` }); n++; }
  }
  // guests who booked directly and arrive tomorrow: practical details and the guest guide
  for (const b of await all(db, `SELECT b.*, o.name AS org_name, o.code, c.data AS cfg, g.token AS gtok FROM bookings b JOIN orgs o ON o.id = b.org_id
      LEFT JOIN app_config c ON c.org_id = b.org_id LEFT JOIN guides g ON g.org_id = b.org_id AND g.apt = b.apt
      WHERE b.date = ? AND b.email != '' AND b.tag = '' AND b.nights > 0 AND o.status = 'active'`, addDays(t, 1))) {
    let cfg: any = {}; try { cfg = JSON.parse(b.cfg || "{}"); } catch {}
    if (cfg.direct && cfg.direct.arrival === false) continue;
    const u = (cfg.units || {})[b.apt] || {};
    await sendMail(env, db, { to: b.email, ...mails.arrival(b.org_name, { apt: b.apt, date: b.date, cin: u.cin || "", addr: (cfg.addr || {})[b.apt] || "", phone: cfg.direct?.phone || "", guide: b.gtok ? await stayGuideUrl(b.org_id, b.id, b.gtok) : "" }, bLang(b)), kind: "arrival", orgId: b.org_id, key: "arrival:" + b.id + ":" + b.date });
    n++;
  }
  for (const i of await all(db, "SELECT i.*, o.name AS org_name FROM invoices i JOIN orgs o ON o.id = i.org_id WHERE i.status = 'sent' AND i.due_at IN (?, ?)", addDays(t, 3), t)) {
    const to = await orgEmail(db, i.org_id); if (!to) continue;
    const m = mails.invoiceDue(i.org_name, i.number, i.amount, i.due_at, `https://espace.md/f/${i.token}`, i.due_at === t);
    await sendMail(env, db, { to, ...m, kind: "invoice_due", orgId: i.org_id, key: `due:${i.id}:${i.due_at === t ? "0" : "3"}` }); n++;
  }
  return n;
}

