// espace.md — transactional email through Resend (https://resend.com).
// Without RESEND_API_KEY nothing is sent: each email is still recorded in the `emails` table with status 'skipped',
// so the admin panel shows what would have gone out.
import { type Env, all, one, run, uuid, today, addDays, billingOf } from "./core";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const dmy = (d: string) => (d && d.length >= 10 ? d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(0, 4) : "");
export const orgUrl = (slug: string) => `https://${slug}.espace.md/`;

// one bilingual layout: Romanian first, Russian under it
function layout(ro: { title: string; body: string }, ru: { title: string; body: string }, button?: { url: string; ro: string; ru: string }) {
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
  requestGot: (org: string, r: any) => ({
    subject: `${org}: am primit cererea ta (${dmy(r.date)})`,
    html: layout(
      { title: "Cererea a fost trimisă", body: `<p>Mulțumim! <b>${esc(org)}</b> a primit cererea pentru <b>${esc(r.apt)}</b>, de pe <b>${dmy(r.date)}</b>, ${r.nights} ${r.nights === 1 ? "noapte" : "nopți"}, ${r.pax} pers. Total: <b>${lei2(r.price)} ${curL(r.cur)}</b>.</p><p>Rezervarea devine fermă după confirmare — primești un email.${r.phone ? " Telefon: " + esc(r.phone) + "." : ""}</p>` },
      { title: "Заявка отправлена", body: `<p>Спасибо! <b>${esc(org)}</b> получил заявку: <b>${esc(r.apt)}</b>, с ${dmy(r.date)}, ${r.nights} н. Итого: ${lei2(r.price)} ${curL(r.cur)}. Бронь станет окончательной после подтверждения — придёт письмо.</p>` }),
  }),
  requestAnswer: (org: string, yes: boolean, r: any) => ({
    subject: yes ? `${org}: rezervarea e confirmată (${dmy(r.date)})` : `${org}: datele nu sunt disponibile`,
    html: layout(
      yes ? { title: "Rezervarea e confirmată", body: `<p><b>${esc(r.apt)}</b>, de pe <b>${dmy(r.date)}</b>, ${r.nights} ${r.nights === 1 ? "noapte" : "nopți"}. Total: <b>${lei2(r.price)} ${curL(r.cur)}</b>.${r.note ? "<br>" + esc(r.note) : ""}</p><p>${r.phone ? "Telefon: <b>" + esc(r.phone) + "</b>. " : ""}Vă așteptăm!</p>` }
          : { title: "Din păcate, datele nu sunt disponibile", body: `<p>${esc(org)} nu poate confirma cererea pentru ${esc(r.apt)} de pe ${dmy(r.date)}.${r.note ? "<br>" + esc(r.note) : ""} Încercați alte date pe pagina de rezervare.</p>` },
      yes ? { title: "Бронь подтверждена", body: `<p>${esc(r.apt)}, с ${dmy(r.date)}, ${r.nights} н. Итого: ${lei2(r.price)} ${curL(r.cur)}. Ждём вас!</p>` }
          : { title: "К сожалению, даты недоступны", body: `<p>${esc(org)} не может подтвердить заявку на ${esc(r.apt)} с ${dmy(r.date)}.</p>` }),
  }),
  trialEnding: (org: string, slug: string, ends: string, price: number | null, balance: number) => ({
    subject: `Perioada de probă ${org} se termină pe ${dmy(ends)}`,
    html: layout(
      { title: "Proba se termină în 3 zile", body: `<p>Perioada gratuită pentru <b>${esc(org)}</b> se termină pe <b>${dmy(ends)}</b>.${price ? ` Tariful tău e <b>${price} lei pe lună</b>, plătit în avans: suplinești contul, iar zilnic se scade partea zilei (${lei2(price * 12 / 365)} lei).` : ""}${balance > 0 ? ` Pe cont ai acum <b>${lei2(balance)} lei</b>.` : " Pe cont nu sunt bani încă — fără suplinire, după această dată datele rămân, dar nu se mai pot face modificări."}</p><p>Factura de suplinire o poți cere din aplicație: Meniu → Setări → Abonament.</p>` },
      { title: "Пробный период заканчивается через 3 дня", body: `<p>Бесплатный период для <b>${esc(org)}</b> заканчивается <b>${dmy(ends)}</b>.${price ? ` Ваш тариф — <b>${price} лей в месяц</b>, оплата вперёд: пополняете счёт, каждый день списывается доля дня (${lei2(price * 12 / 365)} лей).` : ""}${balance > 0 ? ` Сейчас на счёте <b>${lei2(balance)} лей</b>.` : " Без пополнения после этой даты данные сохранятся, но изменять их будет нельзя."} Счёт на пополнение — в приложении: Меню → Настройки → Подписка.</p>` },
      { url: orgUrl(slug), ro: "Deschide compania", ru: "Открыть компанию" }),
  }),
  lowBalance: (org: string, slug: string, balance: number, days: number) => ({
    subject: `${org}: soldul ajunge pentru ${days} ${days === 1 ? "zi" : "zile"}`,
    html: layout(
      { title: "Suplinește contul", body: `<p>Pe contul <b>${esc(org)}</b> au rămas <b>${lei2(balance)} lei</b> — ajung pentru <b>${days} ${days === 1 ? "zi" : "zile"}</b>. Când banii se termină, aplicația trece în modul doar vizualizare până la suplinire.</p><p>Factura o ceri din aplicație: Meniu → Setări → Abonament.</p>` },
      { title: "Пополните счёт", body: `<p>На счёте <b>${esc(org)}</b> осталось <b>${lei2(balance)} лей</b> — хватит на <b>${days}</b> дн. Когда деньги закончатся, приложение перейдёт в режим просмотра до пополнения. Счёт на пополнение — Меню → Настройки → Подписка.</p>` },
      { url: orgUrl(slug), ro: "Deschide compania", ru: "Открыть компанию" }),
  }),
  expired: (org: string, slug: string) => ({
    subject: `${org}: soldul s-a terminat — doar vizualizare`,
    html: layout(
      { title: "Soldul s-a terminat", body: `<p>Banii de pe contul <b>${esc(org)}</b> s-au terminat. Datele sunt în siguranță și le poți vedea, dar modificările sunt oprite până la suplinire. Ceri factura din aplicație (Meniu → Setări → Abonament) sau răspunde la acest email.</p>` },
      { title: "Деньги на счёте закончились", body: `<p>Средства на счёте <b>${esc(org)}</b> закончились. Данные в сохранности и доступны для просмотра, но изменения остановлены до пополнения. Счёт — в приложении (Меню → Настройки → Подписка) или ответьте на это письмо.</p>` },
      { url: orgUrl(slug), ro: "Deschide compania", ru: "Открыть компанию" }),
  }),
  invoice: (org: string, number: string, amount: number, due: string, url: string) => ({
    subject: `Factura ${number} — ${amount} lei — espace.md`,
    html: layout(
      { title: `Factura ${number}`, body: `<p>Pentru <b>${esc(org)}</b>: <b>${amount} lei</b>, scadența <b>${dmy(due)}</b>. În destinația plății indicați numărul facturii.</p>` },
      { title: `Счёт ${number}`, body: `<p>Для <b>${esc(org)}</b>: <b>${amount} лей</b>, оплатить до <b>${dmy(due)}</b>. В назначении платежа укажите номер счёта.</p>` },
      { url, ro: "Deschide factura (PDF)", ru: "Открыть счёт (PDF)" }),
  }),
  invoiceDue: (org: string, number: string, amount: number, due: string, url: string, overdue: boolean) => ({
    subject: overdue ? `Factura ${number} e scadentă azi` : `Factura ${number}: scadența pe ${dmy(due)}`,
    html: layout(
      { title: overdue ? "Factura e scadentă azi" : "Amintire: factura e scadentă curând", body: `<p>Factura <b>${esc(number)}</b> pentru <b>${esc(org)}</b>, <b>${amount} lei</b>, are scadența pe <b>${dmy(due)}</b>. Dacă ai plătit deja, ignoră acest mesaj.</p>` },
      { title: overdue ? "Срок оплаты счёта — сегодня" : "Напоминание об оплате", body: `<p>Счёт <b>${esc(number)}</b> для <b>${esc(org)}</b>, <b>${amount} лей</b>, оплатить до <b>${dmy(due)}</b>. Если уже оплатили — проигнорируйте письмо.</p>` },
      { url, ro: "Deschide factura", ru: "Открыть счёт" }),
  }),
  paid: (org: string, amount: number, balance: number, until: string) => ({
    subject: `Plată primită — ${org}: sold ${lei2(balance)} lei`,
    html: layout(
      { title: "Mulțumim, plata a ajuns", body: `<p>Am pus <b>${lei2(amount)} lei</b> pe contul <b>${esc(org)}</b>. Sold: <b>${lei2(balance)} lei</b>${until ? `, ajunge aproximativ până la <b>${dmy(until)}</b> la numărul actual de apartamente` : ""}.</p>` },
      { title: "Спасибо, оплата получена", body: `<p>Зачислили <b>${lei2(amount)} лей</b> на счёт <b>${esc(org)}</b>. Баланс: <b>${lei2(balance)} лей</b>${until ? `, хватит примерно до <b>${dmy(until)}</b> при текущем числе квартир` : ""}.</p>` }),
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
    if (o.trial_ends === addDays(t, 3)) { await sendMail(env, db, { to, ...mails.trialEnding(o.name, o.code, o.trial_ends, b.price, b.balance), kind: "trial_ending", orgId: o.id, key: `trial3:${o.id}:${o.trial_ends}` }); n++; }
    // balance running low (once per top-up), after the trial
    if (!b.expired && !b.in_trial && b.daily && b.days_left <= 3) { await sendMail(env, db, { to, ...mails.lowBalance(o.name, o.code, b.balance, Math.max(0, b.days_left)), kind: "low_balance", orgId: o.id, key: `low:${o.id}:${last?.id || "none"}` }); n++; }
    // just ran out: yesterday was the last covered day
    if (b.expired && b.covered_until === addDays(t, -1)) { await sendMail(env, db, { to, ...mails.expired(o.name, o.code), kind: "expired", orgId: o.id, key: `expired:${o.id}:${b.covered_until}` }); n++; }
  }
  for (const i of await all(db, "SELECT i.*, o.name AS org_name FROM invoices i JOIN orgs o ON o.id = i.org_id WHERE i.status = 'sent' AND i.due_at IN (?, ?)", addDays(t, 3), t)) {
    const to = await orgEmail(db, i.org_id); if (!to) continue;
    const m = mails.invoiceDue(i.org_name, i.number, i.amount, i.due_at, `https://espace.md/f/${i.token}`, i.due_at === t);
    await sendMail(env, db, { to, ...m, kind: "invoice_due", orgId: i.org_id, key: `due:${i.id}:${i.due_at === t ? "0" : "3"}` }); n++;
  }
  return n;
}

