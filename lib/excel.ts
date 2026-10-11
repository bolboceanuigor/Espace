import { Buffer } from "node:buffer";
import ExcelJS from "exceljs";
import { TEMPLATE_B64 } from "./template";

export type Booking = { id: string; date: string; apt: string; guest: string; nights: number | string; mdl: number | string; eur: number | string; usd: number | string; oth?: number | string; oth_cur?: string; util?: number | string; util_cur?: string; pay: string; who: string; note: string };
export type Cfg = { apts: string[]; rates: { eur: number; usd: number }; other?: { code: string; rate: number }[] };
export type Expense = { id: string; date: string; apt: string; category: string; mdl: number | string; eur: number | string; usd: number | string; oth?: number | string; oth_cur?: string; who: string; note: string };

const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const PAY: Record<string, string> = { "Кэш": "Кэш", "Счёт": "Счёт", "Airbnb": "Airbnb", "Счёт+Кэш": "Счёт + Кэш" };
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const MAGENTA = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF00FF" } } as const;
const GREEN_OCC = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00FF00" } } as const;
// nights are coloured by who has the money: Оксана (first person) violet, Игорь (second) green
const whoFill = (b: any, cfg: any) => { const i = (cfg.people || []).indexOf(b.who); return i === 1 || (i < 0 && /^И/.test(b.who || "")) ? GREEN_OCC : MAGENTA; };
const WHITE = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } } as const;
const PINK = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4CCCC" } } as const;

// exceljs shares style objects between cells; clone before changing so only this cell changes
function setFill(cell: ExcelJS.Cell, fill: any) {
  cell.style = JSON.parse(JSON.stringify(cell.style || {}));
  cell.fill = fill;
}

export const monthTitle = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };

/** Build the monthly workbook in the original layout. ym = "2026-09" */
export async function buildMonthWorkbook(ym: string, bookings: Booking[], cfg: Cfg, expenses: Expense[] = []): Promise<Buffer> {
  const [y, m] = ym.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthStart = Date.UTC(y, m - 1, 1), monthEnd = Date.UTC(y, m, 1), DAY = 86400000;
  const toT = (s: string) => { const [a, b, c] = s.split("-").map(Number); return Date.UTC(a, b - 1, c); };

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(TEMPLATE_B64, "base64"));
  const master = wb.worksheets[0];
  const sheetFor = (apt: string) => wb.getWorksheet(apt.slice(0, 31));

  // apartments not in the template (added later in settings): clone the first sheet's layout
  for (const apt of cfg.apts) {
    if (!sheetFor(apt)) {
      const ws = wb.addWorksheet(apt.slice(0, 31));
      ws.model = Object.assign({}, master.model, { name: apt.slice(0, 31), id: ws.id });
    }
  }
  // remove template sheets for apartments no longer listed
  for (const ws of [...wb.worksheets]) if (!cfg.apts.some((a) => a.slice(0, 31) === ws.name)) wb.removeWorksheet(ws.id);

  for (const apt of cfg.apts) {
    const ws = sheetFor(apt)!;
    ws.getCell("M3").value = cfg.rates.eur;
    ws.getCell("N3").value = cfg.rates.usd;
    for (let d = 1; d <= 31; d++) {
      const r = d + 2;
      ws.getCell(r, 1).value = d <= daysInMonth ? d : null;
      for (let c = 2; c <= 10; c++) ws.getCell(r, c).value = null;
      setFill(ws.getCell(r, 2), WHITE);
      setFill(ws.getCell(r, 3), WHITE);
      ws.getCell(r, 2).note = undefined as any;
    }
    const mine = bookings.filter((b) => b.apt === apt);
    // occupied nights → magenta name cells (also for stays that started last month)
    for (const b of mine) {
      const s = toT(b.date), nights = n(b.nights);
      for (let i = 0; i < nights; i++) {
        const t = s + i * DAY;
        if (t >= monthStart && t < monthEnd) setFill(ws.getCell(new Date(t).getUTCDate() + 2, 2), whoFill(b, cfg));
      }
    }
    // one row per check-in day (a stay that began last month gets a row on day 1); amounts = this month's share by nights
    const byDay = new Map<number, Booking[]>();
    for (const b of mine) {
      const t = toT(b.date), nn = n(b.nights), en = t + nn * DAY;
      const inside = t >= monthStart && t < monthEnd;
      const carried = nn > 0 && t < monthStart && en > monthStart;
      if (!inside && !carried) continue;
      const d = inside ? new Date(t).getUTCDate() : 1;
      byDay.set(d, [...(byDay.get(d) || []), b]);
    }
    const share = (b: Booking) => { const t = toT(b.date), nn = n(b.nights); if (nn <= 0) return 1; const ov = Math.max(0, Math.min(t + nn * DAY, monthEnd) - Math.max(t, monthStart)) / DAY; return ov / nn; };
    const nightsIn = (b: Booking) => { const t = toT(b.date), nn = n(b.nights); return Math.round(Math.max(0, Math.min(t + nn * DAY, monthEnd) - Math.max(t, monthStart)) / DAY); };
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const UL: Record<string, string> = { MDL: "лей", EUR: "€", USD: "$" };
    for (const [d, list] of byDay) {
      const r = d + 2;
      const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
      const names = uniq(list.map((b) => (b.guest || "").trim() + (toT(b.date) < monthStart ? ` (с ${b.date.slice(8)}.${b.date.slice(5, 7)})` : "")));
      const nights = list.reduce((a, b) => a + nightsIn(b), 0);
      const sum = (k: "mdl" | "eur" | "usd") => r2(list.reduce((a, b) => a + n(b[k]) * share(b), 0));
      ws.getCell(r, 2).value = names.join(", ") || null;
      ws.getCell(r, 3).value = nights || null;
      // red/pink on the nights cell = Iulia checked the payment (like in the team's own table)
      if (nights && list.every((b: any) => b.verified)) setFill(ws.getCell(r, 3), PINK);
      ws.getCell(r, 4).value = uniq(list.map((b) => b.who)).join("/") || null;
      ws.getCell(r, 5).value = uniq(list.map((b) => PAY[b.pay] || b.pay)).join(" / ") || null;
      ws.getCell(r, 7).value = sum("mdl") || null;
      ws.getCell(r, 8).value = sum("eur") || null;
      ws.getCell(r, 9).value = sum("usd") || null;
      const oth = new Map<string, number>();
      for (const b of list) if (n(b.oth) && b.oth_cur) oth.set(b.oth_cur, (oth.get(b.oth_cur) || 0) + n(b.oth) * share(b));
      const util = new Map<string, number>();
      for (const b of list) if (n(b.util)) { const c = UL[b.util_cur || "MDL"] || "лей"; util.set(c, (util.get(c) || 0) + n(b.util) * share(b)); }
      const extra = [...[...oth].map(([c, v]) => `${r2(v)} ${c}`), ...[...util].map(([c, v]) => `ком. ${r2(v)} ${c}`)];
      ws.getCell(r, 10).value = extra.length ? extra.join(" + ") : null;
      const split = list.filter((b) => share(b) < 0.999).map((b) => `${b.guest || "без имени"}: всего ${r2(n(b.mdl))} лей / ${r2(n(b.eur))} € / ${r2(n(b.usd))} $ за ${n(b.nights)} ноч. (${b.date.split("-").reverse().join(".")}), в этом месяце ${nightsIn(b)} ноч.`);
      const notes = [...uniq(list.map((b) => (b.note || "").trim())), ...split];
      if (notes.length) ws.getCell(r, 2).note = notes.join("\n");
    }
  }
  // months shorter than 31 days: hide the extra day rows so the sheet shows exactly as many days as the month
  for (const ws of wb.worksheets) {
    for (let d = 1; d <= 31; d++) ws.getRow(d + 2).hidden = d > daysInMonth;
  }
  addSummarySheets(wb, ym, bookings, cfg, expenses, daysInMonth);
  wb.calcProperties.fullCalcOnLoad = true;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const GREEN = { type: "pattern", pattern: "solid", fgColor: { argb: "FF93C47D" } } as const;
const LIGHT = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAD3" } } as const;
const thin = { style: "thin", color: { argb: "FFBFBFBF" } } as const;
const BOX = { top: thin, left: thin, bottom: thin, right: thin } as any;

/** Extra sheets after the apartment sheets: monthly summary (income, expenses, profit) and the expense list. */
function addSummarySheets(wb: ExcelJS.Workbook, ym: string, bookings: Booking[], cfg: Cfg, expenses: Expense[], daysInMonth: number) {
  const font = { name: "Courier New", size: 10 };
  const inMonth = (d: string) => d.slice(0, 7) === ym;
  const rateOf = (c?: string) => (cfg.other || []).find((o) => o.code === c)?.rate || 0;
  const toEur = (x: { mdl: any; eur: any; usd: any; oth?: any; oth_cur?: string }) => n(x.mdl) / cfg.rates.eur + n(x.eur) + n(x.usd) * cfg.rates.usd + n(x.oth) * rateOf(x.oth_cur);
  const [y, m] = ym.split("-").map(Number);
  const monthStart = Date.UTC(y, m - 1, 1), monthEnd = Date.UTC(y, m, 1), DAY = 86400000;
  const toT = (s: string) => { const [a, b, c] = s.split("-").map(Number); return Date.UTC(a, b - 1, c); };
  const header = (ws: ExcelJS.Worksheet, cols: [string, number][]) => {
    cols.forEach(([h, w], i) => { const c = ws.getCell(1, i + 1); c.value = h; c.font = { ...font, bold: true }; c.fill = GREEN as any; c.border = BOX; c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; ws.getColumn(i + 1).width = w; });
    ws.getRow(1).height = 30; ws.views = [{ state: "frozen", ySplit: 1 }];
  };
  const cell = (ws: ExcelJS.Worksheet, r: number, c: number, v: any, fmt?: string, bold = false) => {
    const x = ws.getCell(r, c); x.value = v; x.font = { ...font, bold }; x.border = BOX; if (fmt) x.numFmt = fmt;
    x.alignment = { horizontal: c === 1 ? "left" : "center", vertical: "middle" };
  };

  // ---- Итоги
  const s = wb.addWorksheet("Итоги", { properties: { tabColor: { argb: "FF93C47D" } } });
  header(s, [["Квартира", 18], ["Заезды", 9], ["Ночи", 8], ["Загрузка", 10], ["Доход €", 12], ["Расходы €", 12], ["Прибыль €", 12], ["€ за ночь", 11], ["в т.ч. коммуналка €", 13]]);
  const utilEur = (b: Booking) => { const u = n(b.util); return !u ? 0 : b.util_cur === "EUR" ? u : b.util_cur === "USD" ? u * cfg.rates.usd : u / cfg.rates.eur; };
  const shareM = (b: Booking) => { const t = toT(b.date), nn = n(b.nights); if (nn <= 0) return inMonth(b.date) ? 1 : 0; return Math.max(0, Math.min(t + nn * DAY, monthEnd) - Math.max(t, monthStart)) / DAY / nn; };
  const sharedExp = expenses.filter((e) => inMonth(e.date) && !cfg.apts.includes(e.apt)).reduce((a, e) => a + toEur(e), 0);
  let r = 2;
  for (const apt of cfg.apts) {
    const mine = bookings.filter((b) => b.apt === apt);
    const nightsSet = new Set<number>();
    for (const b of mine) for (let i = 0; i < n(b.nights); i++) { const t = toT(b.date) + i * DAY; if (t >= monthStart && t < monthEnd) nightsSet.add(t); }
    const util = mine.reduce((a, b) => a + utilEur(b) * shareM(b), 0);
    const inc = mine.reduce((a, b) => a + toEur(b) * shareM(b), 0) + util;
    const exp = expenses.filter((e) => e.apt === apt && inMonth(e.date)).reduce((a, e) => a + toEur(e), 0);
    cell(s, r, 1, apt); cell(s, r, 2, mine.filter((b) => inMonth(b.date) && n(b.nights) > 0).length);
    cell(s, r, 3, nightsSet.size); cell(s, r, 4, { formula: `C${r}/${daysInMonth}` }, "0%");
    cell(s, r, 5, Math.round(inc * 100) / 100, "#,##0.00"); cell(s, r, 6, Math.round(exp * 100) / 100, "#,##0.00");
    cell(s, r, 7, { formula: `E${r}-F${r}` }, "#,##0.00"); cell(s, r, 8, { formula: `IF(C${r}=0,"",(E${r}-I${r})/C${r})` }, "#,##0.00");
    cell(s, r, 9, util ? Math.round(util * 100) / 100 : null, "#,##0.00");
    r++;
  }
  cell(s, r, 1, "Общие расходы"); for (let c = 2; c <= 5; c++) cell(s, r, c, null);
  cell(s, r, 6, Math.round(sharedExp * 100) / 100, "#,##0.00"); cell(s, r, 7, { formula: `-F${r}` }, "#,##0.00"); cell(s, r, 8, null); cell(s, r, 9, null);
  const last = r; r++;
  cell(s, r, 1, "ВСЕГО", undefined, true);
  cell(s, r, 2, { formula: `SUM(B2:B${last})` }, undefined, true); cell(s, r, 3, { formula: `SUM(C2:C${last})` }, undefined, true);
  cell(s, r, 4, { formula: `C${r}/(${daysInMonth}*${cfg.apts.length})` }, "0%", true);
  for (const c of [5, 6, 7]) cell(s, r, c, { formula: `SUM(${"ABCDEFGH"[c - 1]}2:${"ABCDEFGH"[c - 1]}${last})` }, "#,##0.00", true);
  cell(s, r, 8, { formula: `IF(C${r}=0,"",(E${r}-I${r})/C${r})` }, "#,##0.00", true);
  cell(s, r, 9, { formula: `SUM(I2:I${last})` }, "#,##0.00", true);
  for (let c = 1; c <= 9; c++) s.getCell(r, c).fill = LIGHT as any;
  s.getCell(r + 2, 1).value = `Курс: 1 € = ${cfg.rates.eur} лей, 1 $ = ${cfg.rates.usd} €. Доход делится по ночам: если гость живёт с 16.09 по 16.10, часть денег идёт в сентябрь, часть — в октябрь. Коммуналка от гостей входит в доход.`;
  s.getCell(r + 2, 1).font = { ...font, italic: true, color: { argb: "FF808080" } };

  // ---- Расходы
  const e = wb.addWorksheet("Расходы", { properties: { tabColor: { argb: "FFE06666" } } });
  header(e, [["Дата", 12], ["Квартира", 18], ["Категория", 18], ["Леи", 10], ["Евро", 10], ["Доллар", 10], ["Итого €", 11], ["Кто платил", 11], ["Примечание", 36], ["Другое", 12]]);
  const list = expenses.filter((x) => inMonth(x.date)).sort((a, b) => a.date.localeCompare(b.date));
  r = 2;
  for (const x of list) {
    const [yy, mm, dd] = x.date.split("-");
    cell(e, r, 1, `${dd}.${mm}.${yy}`); cell(e, r, 2, x.apt || "Общие"); cell(e, r, 3, x.category);
    cell(e, r, 4, n(x.mdl) || null, "#,##0.##"); cell(e, r, 5, n(x.eur) || null, "#,##0.##"); cell(e, r, 6, n(x.usd) || null, "#,##0.##");
    cell(e, r, 7, Math.round(toEur(x) * 100) / 100, "#,##0.00"); cell(e, r, 8, x.who || null); cell(e, r, 9, x.note || null);
    e.getCell(r, 9).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    cell(e, r, 10, n(x.oth) && x.oth_cur ? `${n(x.oth)} ${x.oth_cur}` : null);
    r++;
  }
  if (!list.length) { e.getCell(2, 1).value = "В этом месяце расходов нет"; e.getCell(2, 1).font = { ...font, italic: true }; r = 3; }
  cell(e, r, 1, "ВСЕГО", undefined, true);
  for (const [c, L] of [[4, "D"], [5, "E"], [6, "F"], [7, "G"]] as [number, string][]) cell(e, r, c, { formula: `SUM(${L}2:${L}${Math.max(2, r - 1)})` }, "#,##0.00", true);
  for (let c = 1; c <= 9; c++) e.getCell(r, c).fill = LIGHT as any;
}

export type Handover = { id: string; title: string; person: string; date_from: string; date_to: string; rows: any[]; cols: string[]; note: string };
const CUR_LABEL: Record<string, string> = { UAH: "grivne", RON: "lei RO", GBP: "lire" };

/** One sheet per handover, laid out like the team's own sheet: apartment | comment | lei on account (green) | euro | dol | lei | other… and a yellow "итого" row. */
export async function buildHandoverWorkbook(handovers: Handover[], cfg: Cfg): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const font = { name: "Arial", size: 10 };
  const GREENC = { type: "pattern", pattern: "solid", fgColor: { argb: "FF93C47D" } } as any;
  const YELLOW = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } } as any;
  const used = new Set<string>();
  const list = [...handovers].sort((a, b) => a.date_from.localeCompare(b.date_from));
  if (!list.length) { const ws = wb.addWorksheet("Пересменка"); ws.getCell("A1").value = "Пока нет ни одной пересменки"; }
  for (const h of list) {
    let name = (h.title || `${h.date_from.slice(8)}-${h.date_to.slice(8)}`).replace(/[\\/?*\[\]:]/g, "-").slice(0, 31) || "Сдача";
    let k = 2; const base = name; while (used.has(name)) name = `${base.slice(0, 28)} (${k++})`; used.add(name);
    const ws = wb.addWorksheet(name);
    const cols = Array.isArray(h.cols) ? h.cols : [];
    const isAir = (r: any) => r.src === "Airbnb";
    const heads = ["", "", "", "", "euro", "dol", "lei", ...cols.map((c) => CUR_LABEL[c] || c.toLowerCase())];
    const widths = [18, 22, 4, 10, 9, 9, 9, ...cols.map(() => 9)];
    heads.forEach((v, i) => { const c = ws.getCell(1, i + 1); c.value = v || null; c.font = font; ws.getColumn(i + 1).width = widths[i]; });
    ws.getCell(1, 1).value = `${h.person ? h.person + " · " : ""}${h.date_from.split("-").reverse().join(".")} — ${h.date_to.split("-").reverse().join(".")}`;
    ws.getCell(1, 1).font = { ...font, italic: true, color: { argb: "FF808080" } };
    const rank = (r: any) => { const i = cfg.apts.indexOf(r.apt); return i >= 0 ? i : (r.apt ? 1000 : 2000); };
    const day = (r: any) => (r.kind === "exp" ? (r.ed || r.d) : r.d) || h.date_from;
    const rows = (Array.isArray(h.rows) ? h.rows : []).map((r: any, i: number) => ({ r, i })).sort((a: any, b: any) => day(a.r).localeCompare(day(b.r)) || rank(a.r) - rank(b.r) || a.i - b.i).map((x: any) => x.r);
    // a date line before each day's rows: "СМЕНА 04.10.2026", then "05.10.2026" …
    let R = 1, lastD = "";
    rows.forEach((r: any) => {
      const dd = day(r);
      if (dd !== lastD) {
        R++; const c = ws.getCell(R, 1); c.value = (lastD ? "" : "СМЕНА ") + dd.split("-").reverse().join(".");
        c.font = { ...font, bold: true, color: { argb: "FF202248" } }; lastD = dd;
      }
      R++;
      const vals: any[] = [(r.kind === "exp" ? "− " + [r.apt, r.cat].filter(Boolean).join(" · ") : r.apt) || null, r.note || null, null, n(r.schet) || null, n(r.eur) || null, n(r.usd) || null, n(r.mdl) || null, ...cols.map((c) => n(r.oth?.[c]) || null)];
      if (isAir(r)) { vals[2] = "A"; vals[4] = (n(r.eur) + n(r.abnb)) || null; if (!r.note) vals[1] = "Airbnb — не в кассе"; }
      vals.forEach((v, j) => { const c = ws.getCell(R, j + 1); c.value = v; c.font = font; if (j >= 3) c.alignment = { horizontal: "right" }; });
      if (isAir(r)) ws.getCell(R, 5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE8E7" } } as any;
    });
    const T = Math.max(R + 2, 4);
    const lastCol = 7 + cols.length;
    for (let R = 1; R <= T; R++) ws.getCell(R, 4).fill = GREENC;
    ws.getCell(T, 1).value = "итого"; ws.getCell(T, 1).font = { ...font, bold: true };
    for (let C = 4; C <= lastCol; C++) {
      const L = ws.getColumn(C).letter;
      const c = ws.getCell(T, C); c.value = { formula: `SUMIF(C2:C${T - 1},"<>A",${L}2:${L}${T - 1})` } as any; c.font = { ...font, bold: true }; c.alignment = { horizontal: "right" };
      if (C > 4) c.fill = YELLOW;
    }
    const eurOfRow = (r: any) => n(r.schet) / cfg.rates.eur + n(r.eur) + n(r.usd) * cfg.rates.usd + n(r.mdl) / cfg.rates.eur + cols.reduce((a, c) => a + n(r.oth?.[c]) * ((cfg.other || []).find((o) => o.code === c)?.rate || 0), 0);
    const tot = rows.reduce((a: number, r: any) => a + (isAir(r) ? eurOfRow({ ...r, eur: 0 }) : eurOfRow(r)), 0);
    const air = rows.filter(isAir).reduce((a: number, r: any) => a + n(r.eur) + n(r.abnb), 0);
    ws.getCell(T + 1, 1).value = `≈ ${Math.round(tot)} € по курсу 1 € = ${cfg.rates.eur} лей, 1 $ = ${cfg.rates.usd} €`;
    ws.getCell(T + 1, 1).font = { ...font, italic: true, color: { argb: "FF808080" } };
    if (air) { ws.getCell(T + 2, 1).value = `+ оплачено в Airbnb: ${Math.round(air * 100) / 100} € — не в кассе`; ws.getCell(T + 2, 1).font = { ...font, bold: true, color: { argb: "FFA3271F" } }; }
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  wb.calcProperties.fullCalcOnLoad = true;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
