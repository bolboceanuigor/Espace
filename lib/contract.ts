// Short-term rental contract with the guest: filled from the booking, signed by the guest on their phone
// at <slug>.espace.md/contract/<token>. Three languages; the company can replace the text in Settings → Contract.
// {placeholders}: company and booking ones are filled when the link is made, the guest ones ({oaspete}, {act},
// {cetatenie}, {persoane}) when the guest signs.

export type Lang = "ro" | "ru" | "en";
export const GUEST_KEYS = ["oaspete", "act", "cetatenie", "persoane"];

export const DEFAULT_TPL: Record<Lang, string> = {
  ro: `CONTRACT DE ÎNCHIRIERE PE TERMEN SCURT nr. {nr}
{oras}, {data}

Locator: {firma}{idno}, adresa {adresa_firma}, telefon {tel}.
Locatar: {oaspete}, act de identitate {act}, cetățenia {cetatenie}.

1. Obiectul contractului
Locatorul dă locatarului în folosință temporară, pentru cazare, locuința „{obiect}”, adresa {adresa}, pentru {persoane} persoane.

2. Termenul
De la {sosire}, ora {checkin}, până la {plecare}, ora {checkout} — {nopti} nopți.

3. Prețul
{pret} pentru toată perioada. Garanție: {garantie}.

4. Locatarul se obligă
— să folosească locuința și bunurile din ea cu grijă și doar pentru cazare;
— să nu cazeze alte persoane decât cele declarate;
— să respecte liniștea între orele 22:00 și 08:00 și să nu fumeze în interior;
— să predea la plecare locuința în starea în care a primit-o, împreună cu cheile;
— să repare sau să achite prejudiciile pe care le-a cauzat.

5. Locatorul se obligă
— să predea locuința curată, în stare de funcționare, cu lenjerie și utilități incluse;
— să comunice locatarului cum ajunge, cum intră și cui se adresează în caz de probleme.

6. Regulile casei
{reguli}

7. Alte prevederi
Neînțelegerile se rezolvă pe cale amiabilă, iar dacă nu e posibil — conform legislației Republicii Moldova. Locatarul confirmă că a citit contractul și regulile casei și este de acord cu ele, semnând pe această pagină.`,
  ru: `ДОГОВОР КРАТКОСРОЧНОЙ АРЕНДЫ № {nr}
{oras}, {data}

Наймодатель: {firma}{idno}, адрес {adresa_firma}, телефон {tel}.
Наниматель: {oaspete}, документ {act}, гражданство {cetatenie}.

1. Предмет договора
Наймодатель предоставляет нанимателю во временное пользование для проживания жильё «{obiect}» по адресу {adresa} для {persoane} человек.

2. Срок
С {sosire}, {checkin}, до {plecare}, {checkout} — ночей: {nopti}.

3. Цена
{pret} за весь период. Залог: {garantie}.

4. Наниматель обязуется
— бережно пользоваться жильём и вещами в нём и только для проживания;
— не селить других людей, кроме заявленных;
— соблюдать тишину с 22:00 до 08:00 и не курить внутри;
— при выезде сдать жильё в том состоянии, в котором получил, вместе с ключами;
— возместить ущерб, если он его причинил.

5. Наймодатель обязуется
— передать жильё чистым, исправным, с бельём, коммунальные услуги включены;
— сообщить, как добраться, как войти и к кому обращаться при проблемах.

6. Правила дома
{reguli}

7. Прочее
Споры решаются переговорами, а если это невозможно — по законодательству Республики Молдова. Подписывая на этой странице, наниматель подтверждает, что прочитал договор и правила дома и согласен с ними.`,
  en: `SHORT-TERM RENTAL AGREEMENT No. {nr}
{oras}, {data}

Host: {firma}{idno}, address {adresa_firma}, phone {tel}.
Guest: {oaspete}, ID document {act}, citizenship {cetatenie}.

1. Subject
The host gives the guest temporary use of the accommodation “{obiect}”, address {adresa}, for {persoane} people.

2. Term
From {sosire}, {checkin}, to {plecare}, {checkout} — {nopti} nights.

3. Price
{pret} for the whole stay. Deposit: {garantie}.

4. The guest agrees
— to use the accommodation and everything in it with care and only for staying;
— not to host people other than those declared;
— to keep quiet between 22:00 and 08:00 and not to smoke inside;
— to hand back the accommodation as received, with the keys, at check-out;
— to repair or pay for any damage they caused.

5. The host agrees
— to hand over the accommodation clean and in working order, with linen and utilities included;
— to tell the guest how to get there, how to get in and whom to call if something goes wrong.

6. House rules
{reguli}

7. Other
Disagreements are settled amicably, otherwise under the laws of the Republic of Moldova. By signing on this page the guest confirms they have read and accept the agreement and the house rules.`,
};

export const fill = (t: string, v: Record<string, string>) => t.replace(/\{([a-z_]+)\}/g, (m, k) => (k in v ? v[k] : m));
const dmy = (d: string) => (d && d.length >= 10 ? d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(0, 4) : "");
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const CUR: Record<string, string> = { MDL: "lei", EUR: "€", USD: "$" };
const money = (n: number) => (Math.round(n * 100) / 100).toLocaleString("ro-RO", { maximumFractionDigits: 2 });

// the texts for one booking, with everything but the guest's own details filled in
export function contractTexts(cfg: any, orgName: string, b: any, nr: string, today: string) {
  const c = cfg.contract || {}, u = (cfg.units || {})[b.apt] || {};
  const price = +b.price > 0 ? `${money(+b.price)} ${CUR[b.price_cur] || b.price_cur || "€"}`
    : +b.eur > 0 ? `${money(+b.eur)} €` : +b.mdl > 0 ? `${money(+b.mdl)} lei` : +b.usd > 0 ? `${money(+b.usd)} $` : "—";
  const v: Record<string, string> = {
    nr, data: dmy(today), oras: c.city || "Chișinău", firma: c.landlord || orgName, idno: c.idno ? `, IDNO/IDNP ${c.idno}` : "",
    adresa_firma: c.addr || "—", tel: c.phone || (cfg.direct || {}).phone || "—", obiect: b.apt, adresa: (cfg.addr || {})[b.apt] || "—",
    sosire: dmy(b.date), plecare: dmy(addDays(b.date, Math.max(1, +b.nights || 1))), checkin: u.cin || "14:00", checkout: u.cout || "12:00",
    nopti: String(Math.max(1, +b.nights || 1)), pret: price, garantie: c.deposit || "—", reguli: c.rules || "—",
  };
  const out: Record<Lang, string> = { ro: "", ru: "", en: "" };
  for (const l of ["ro", "ru", "en"] as Lang[]) out[l] = fill(String((c.tpl || {})[l] || "").trim() || DEFAULT_TPL[l], v);
  return out;
}
