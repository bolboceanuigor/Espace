// Notification titles in the reader's language (ru / ro / en).
// notify() writes one text; the bell list and the phone push translate it here,
// so a manager who uses the app in Romanian does not get Russian notifications.
type L = "ru" | "ro" | "en";
const MON: Record<L, string[]> = {
  ru: ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
  ro: ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
// [ru, ro, en] — fixed beginnings of a title; the rest of the text (apartment, guest) stays as it is
const PREFIX: [string, string, string][] = [
  ["💳 Оплата: ", "💳 Plată: ", "💳 Payment: "],
  ["⏰ Напоминание", "⏰ Memento", "⏰ Reminder"],
  ["Запрос на бронь: ", "Cerere de rezervare: ", "Booking request: "],
  ["Запрос из предложения: ", "Cerere din ofertă: ", "Request from an offer: "],
  ["Договор подписан: ", "Contract semnat: ", "Contract signed: "],
  ["🛎️ Услуга: ", "🛎️ Serviciu: ", "🛎️ Service: "],
  ["✓ Убрано: ", "✓ Curățat: ", "✓ Cleaned: "],
  ["🔧 Починено: ", "🔧 Reparat: ", "🔧 Fixed: "],
  ["🧴 Кончается: ", "🧴 Se termină: ", "🧴 Running out: "],
  ["⚠ Не сходится: ", "⚠ Nu se potrivește: ", "⚠ Doesn't match: "],
  ["✕ Отмена: ", "✕ Anulare: ", "✕ Cancelled: "],
  ["📋 Изменения в списке на ", "📋 Modificări în lista pe ", "📋 Changes to the list for "],
  ["📋 Список на ", "📋 Lista pe ", "📋 List for "],
];
const SUFFIX: [string, string, string][] = [[": нужно починить", ": de reparat", ": needs fixing"]];
const WHOLE: [string, string, string][] = [
  ["Уведомления работают", "Notificările funcționează", "Notifications work"],
  ["Все оплаты и смены проверены", "Toate plățile și turele sunt verificate", "All payments and shifts are checked"],
];
const IX: Record<L, number> = { ru: 0, ro: 1, en: 2 };

export function ntr(s: string, lang: string): string {
  const l = (["ru", "ro", "en"].includes(lang) ? lang : "ru") as L, k = IX[l];
  if (!s) return s;
  for (const row of WHOLE) for (const v of row) if (s === v) return row[k];
  for (const row of PREFIX) for (const v of row) if (s.startsWith(v)) { s = row[k] + s.slice(v.length); break; }
  for (const row of SUFFIX) for (const v of row) if (s.endsWith(v)) { s = s.slice(0, s.length - v.length) + row[k]; break; }
  // "Сегодня у тебя 3 уборки" — the maid's morning list
  const m = /^Сегодня у тебя (\d+) (?:уборка|уборки|уборок)(.*)$/.exec(s);
  if (m && l !== "ru") s = (l === "ro" ? `Curățenii azi: ${m[1]}` : `Cleanings today: ${m[1]}`) + m[2];
  // "✅ Месяц закрыт: ноябрь 2026" — the month name too
  const c = /^(✅ )(?:Месяц закрыт|Luna închisă|Month closed): (\S+) (\d{4})$/.exec(s);
  if (c) { let i = -1; for (const x of Object.values(MON)) { const j = x.indexOf(c[2]); if (j >= 0) i = j; }
    s = c[1] + ["Месяц закрыт", "Luna închisă", "Month closed"][k] + ": " + (i >= 0 ? MON[l][i] : c[2]) + " " + c[3]; }
  if (l !== "ru") s = s.replace(/(\d) лей(?![а-яё])/g, l === "ro" ? "$1 lei" : "$1 MDL");
  if (l !== "ru") {
    const ro = l === "ro";
    s = s.replace(/(\d+) н\./g, "$1 n.")
      .replace(/без имени/g, ro ? "fără nume" : "no name")
      .replace(/\(есть фото\)/g, ro ? "(cu poză)" : "(with photo)")
      .replace(/^Сейчас /, ro ? "Acum " : "Now ")
      .replace(/ · записал\(а\) /, ro ? " · a notat " : " · noted by ");
  }
  return s;
}
export const ntrMsg = <T extends { title: string; body?: string }>(m: T, lang: string): T => ({ ...m, title: ntr(m.title, lang), body: m.body ? ntr(m.body, lang) : m.body });
