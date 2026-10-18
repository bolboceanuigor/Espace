// Public guest guide: /g/<token>?l=ru|ro|en  and photos at /g/m/<id>
// No login: the random token in the link is the only key, so the page shows nothing else from the app.
interface Env { DB: D1Database }
// (multi-tenant: the token decides the company; nothing from other companies is read)

const SECTIONS: [string, string, Record<string, string>][] = [
  ["checkin", "🏠", { ru: "Заселение", ro: "Cazare", en: "Check-in" }],
  ["enter", "🔑", { ru: "Как войти", ro: "Cum intrați", en: "How to get in" }],
  ["wifi", "📶", { ru: "Wi‑Fi", ro: "Wi‑Fi", en: "Wi‑Fi" }],
  ["parking", "🚗", { ru: "Парковка", ro: "Parcare", en: "Parking" }],
  ["boiler", "🔥", { ru: "Бойлер и горячая вода", ro: "Boilerul și apa caldă", en: "Boiler & hot water" }],
  ["trash", "🗑️", { ru: "Мусор", ro: "Gunoiul", en: "Trash" }],
  ["food", "🍽️", { ru: "Рестораны рядом", ro: "Restaurante în apropiere", en: "Restaurants nearby" }],
  ["rules", "📋", { ru: "Правила", ro: "Reguli", en: "House rules" }],
  ["checkout", "👋", { ru: "Выезд", ro: "Plecarea", en: "Check-out" }],
];
const UI: Record<string, Record<string, string>> = {
  ru: { where: "Где квартира", guide: "Гид для гостя", address: "Адрес", map: "Открыть в Google Maps", video: "Смотреть видео", hello: "Добро пожаловать!", empty: "Скоро здесь появится информация.", svc: "Дополнительные услуги", order: "Заказать", name: "Имя", phone: "Телефон", note: "Комментарий", send: "Отправить", sent: "Заявка отправлена — хозяин свяжется с вами.", need: "Укажите имя и телефон.", err: "Не отправилось. Попробуйте ещё раз.", free: "по запросу" },
  ro: { where: "Unde e apartamentul", guide: "Ghidul oaspetelui", address: "Adresa", map: "Deschide în Google Maps", video: "Vezi video", hello: "Bine ați venit!", empty: "Informațiile vor apărea în curând.", svc: "Servicii suplimentare", order: "Comandă", name: "Numele", phone: "Telefon", note: "Comentariu", send: "Trimite", sent: "Cererea a fost trimisă — gazda vă contactează.", need: "Scrieți numele și telefonul.", err: "Nu s-a trimis. Încercați din nou.", free: "la cerere" },
  en: { where: "Where is the apartment", guide: "Guest guide", address: "Address", map: "Open in Google Maps", video: "Watch video", hello: "Welcome!", empty: "Information coming soon.", svc: "Extra services", order: "Order", name: "Name", phone: "Phone", note: "Note", send: "Send", sent: "Request sent — the host will contact you.", need: "Add your name and phone.", err: "Could not send. Try again.", free: "on request" },
};
const LANGS = ["ru", "ro", "en"];

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const linkify = (s: string) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, "<br>");
const has = (x: any) => !!x && (String(x.all || "").trim() || LANGS.some((l) => String(x[l] || "").trim()) || (x.media || []).length || (x.video || []).some((v: string) => v));
const ytId = (u: string) => (u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/) || [])[1];

function pickLang(req: Request, url: URL) {
  const q = url.searchParams.get("l");
  if (q && LANGS.includes(q)) return q;
  const al = (req.headers.get("accept-language") || "").toLowerCase();
  for (const part of al.split(",")) { const c = part.trim().slice(0, 2); if (c === "ro" || c === "mo") return "ro"; if (c === "ru" || c === "uk" || c === "be") return "ru"; if (c === "en") return "en"; }
  return "en";
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  const parts = ([] as string[]).concat((params as any).path || []);
  const db = env.DB;
  if (parts[0] === "m" && /^[0-9a-f-]{36}$/i.test(parts[1] || "")) {
    const r: any = await db.prepare("SELECT data FROM guide_media WHERE id = ?").bind(parts[1]).first();
    if (!r) return new Response("not found", { status: 404 });
    const m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(r.data);
    if (!m) return new Response("bad", { status: 500 });
    const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    return new Response(bin, { headers: { "content-type": m[1], "cache-control": "public, max-age=31536000, immutable" } });
  }
  const token = parts[0] || "";
  if (!/^[a-z0-9]{6,20}$/.test(token)) return new Response("not found", { status: 404 });
  const g: any = await db.prepare("SELECT org_id, apt, data FROM guides WHERE token = ? AND apt != '*'").bind(token).first();
  if (!g) return new Response("Ссылка недействительна / Link not valid", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const common: any = await db.prepare("SELECT data FROM guides WHERE org_id = ? AND apt = '*'").bind(g.org_id).first();
  const cfgRow: any = await db.prepare("SELECT data FROM app_config WHERE org_id = ?").bind(g.org_id).first();
  const orgRow: any = await db.prepare("SELECT name FROM orgs WHERE id = ?").bind(g.org_id).first();
  const brand = String(orgRow?.name || "espace.md");
  let d: any = {}, c: any = {}, cfg: any = {};
  let loc: any = {};
  try { const all = JSON.parse(g.data); d = all.sec || {}; loc = all.loc || {}; } catch {}
  try { c = common ? JSON.parse(common.data).sec || {} : {}; } catch {}
  try { cfg = cfgRow ? JSON.parse(cfgRow.data) : {}; } catch {}
  const url = new URL(request.url);
  const L = pickLang(request, url), T = UI[L];
  const addr = String((cfg.addr || {})[g.apt] || loc.addr || "").trim();
  const pt = String(loc.map || "").trim();
  const mapQ = pt && !/^https?:/.test(pt) ? pt : addr.split(/,\s*(?:кв|подъезд|под\.|этаж|эт\.|ap|apt|scara|etaj|bl)/i)[0] + ", Chișinău";
  const mapLink = /^https?:/.test(pt) ? pt : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(mapQ);
  const locHtml = addr || pt ? `<section id="where"><h2><span>📍</span>${esc(T.where)}</h2>${addr ? `<p class="all">${esc(addr)}</p>` : ""}<iframe class="map" loading="lazy" src="https://maps.google.com/maps?q=${encodeURIComponent(mapQ)}&z=16&output=embed" title="map"></iframe><a class="vbtn" href="${esc(mapLink)}" target="_blank" rel="noopener">🧭 ${esc(T.map)}</a></section>` : "";

  const secs = SECTIONS.map(([k, ic, names]) => {
    const s = has(d[k]) ? d[k] : has(c[k]) ? c[k] : null;
    if (!s) return "";
    const txt = s ? (String(s[L] || "").trim() || String(s.ru || s.en || s.ro || "").trim()) : "";
    const all = s ? String(s.all || "").trim() : "";
    const media = (s?.media || []).map((id: string) => `<a href="/g/m/${esc(id)}" target="_blank"><img loading="lazy" src="/g/m/${esc(id)}" alt=""></a>`).join("");
    const vids = (s?.video || []).filter(Boolean).map((v: string) => { const y = ytId(v); return y ? `<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/${esc(y)}" allowfullscreen loading="lazy" title="video"></iframe></div>` : `<a class="vbtn" href="${esc(v)}" target="_blank" rel="noopener">▶ ${esc(T.video)}</a>`; }).join("");
    const ad = "";
    return `<section id="${k}"><h2><span>${ic}</span>${esc(names[L])}</h2>${ad}${all ? `<p class="all">${linkify(all)}</p>` : ""}${txt ? `<p>${linkify(txt)}</p>` : ""}${media ? `<div class="ph">${media}</div>` : ""}${vids}</section>`;
  }).filter(Boolean);
  if (locHtml) secs.unshift(locHtml);
  const svcs = (Array.isArray(cfg.services) ? cfg.services : []).filter((x: any) => x && x.on !== false && x.name);
  const CUR: Record<string, string> = { EUR: "€", USD: "$", MDL: "lei" };
  const svcHtml = svcs.length ? `<section id="svc"><h2><span>🛎️</span>${esc(T.svc)}</h2>
    ${svcs.map((s: any) => {
      const price = +s.price > 0 ? `${Math.round(+s.price * 100) / 100}\u00a0${CUR[s.cur] || "€"}` : T.free;
      return `<div class="svc" data-sid="${esc(s.id)}"><div class="svh"><b>${esc(s.name)}</b><span>${esc(price)}</span></div>
        <button type="button" class="obtn" data-order="${esc(s.id)}" data-name="${esc(s.name)}">${esc(T.order)}</button></div>`;
    }).join("")}
    <div class="sheet" id="sh" hidden><div class="shbox"><h3 id="sh-t"></h3>
      <label>${esc(T.name)}<input id="o-name" maxlength="80" autocomplete="name"></label>
      <label>${esc(T.phone)}<input id="o-phone" type="tel" maxlength="40" autocomplete="tel"></label>
      <label>${esc(T.note)}<input id="o-note" maxlength="300"></label>
      <p class="msg" id="o-err" hidden></p>
      <div class="ob"><button type="button" class="ghost" id="o-x">✕</button><button type="button" class="vbtn" id="o-go">${esc(T.send)}</button></div>
    </div></div>
    <p class="okmsg" id="o-ok" hidden>${esc(T.sent)}</p></section>` : "";
  if (svcHtml) secs.push(svcHtml);
  const chips = (locHtml ? `<a href="#where">📍 ${esc(T.where)}</a>` : "") + SECTIONS.filter(([k]) => secs.some((h) => h.startsWith(`<section id="${k}"`))).map(([k, ic, n]) => `<a href="#${k}">${ic} ${esc(n[L])}</a>`).join("") + (svcs.length ? `<a href="#svc">🛎️ ${esc(T.svc)}</a>` : "");
  const langs = LANGS.map((l) => `<a href="?l=${l}"${l === L ? ' aria-current="true"' : ""}>${l.toUpperCase()}</a>`).join("");

  const html = `<!doctype html><html lang="${L}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(g.apt)} · ${esc(brand)}</title><link rel="icon" href="/icon.svg">
<style>
:root{--bg:#f6f3ee;--card:#fff;--fg:#17140a;--mut:#6f6a60;--acc:#fed36a;--acc2:#ef8159;--line:#ebe5da}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.hero{background:linear-gradient(135deg,#fed36a,#f8ae52 55%,#ef8159);padding:22px 18px 26px;border-radius:0 0 28px 28px}
.top{display:flex;align-items:center;gap:10px;max-width:640px;margin:0 auto}.top img{width:34px;height:34px;border-radius:50%;background:#fff}.top b{font-weight:800;letter-spacing:.02em}
.lang{margin-left:auto;display:flex;background:rgba(23,20,10,.12);border-radius:999px;padding:3px}.lang a{color:var(--fg);text-decoration:none;font-weight:800;font-size:13px;padding:6px 10px;border-radius:999px}.lang a[aria-current]{background:var(--fg);color:var(--acc)}
.hero h1{max-width:640px;margin:18px auto 0;font-size:30px;line-height:1.1}.hero small{display:block;max-width:640px;margin:4px auto 0;font-weight:700;opacity:.75}
.chips{max-width:640px;margin:14px auto 0;display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}.chips a{flex:none;background:rgba(255,255,255,.55);color:var(--fg);text-decoration:none;font-weight:700;font-size:13.5px;padding:7px 11px;border-radius:999px}
main{max-width:640px;margin:0 auto;padding:14px 14px 40px}
section{background:var(--card);border-radius:20px;padding:16px;margin-top:12px;scroll-margin-top:12px;box-shadow:0 1px 0 var(--line)}
h2{margin:0 0 8px;font-size:19px;display:flex;align-items:center;gap:8px}h2 span{width:34px;height:34px;border-radius:11px;background:#fff4d6;display:grid;place-items:center;font-size:18px}
p{margin:6px 0}p.all{font-weight:700;background:#fbf7ef;border-radius:12px;padding:10px 12px;font-family:ui-monospace,Menlo,monospace;font-size:15px}
a{color:#b4531f}.addr{background:#fbf7ef;border-radius:12px;padding:10px 12px;margin-bottom:6px}
.ph{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:8px}.ph img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block}
.vid{position:relative;padding-top:56.25%;margin-top:8px;border-radius:12px;overflow:hidden}.vid iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.vbtn{display:inline-block;margin-top:8px;background:var(--fg);color:var(--acc);text-decoration:none;font-weight:800;padding:10px 14px;border-radius:12px;border:0;cursor:pointer;font:inherit}
.map{width:100%;height:240px;border:0;border-radius:14px;display:block;margin-top:8px}
.empty{color:var(--mut);text-align:center;padding:30px}footer{text-align:center;color:var(--mut);font-size:13px;margin-top:20px}
.svc{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--line)}.svc:first-of-type{border-top:0;padding-top:0}
.svh{display:flex;flex-direction:column;gap:2px;min-width:0}.svh b{font-size:15.5px}.svh span{color:var(--mut);font-size:13.5px;font-weight:700}
.obtn{flex:none;border:0;background:#fff4d6;color:var(--fg);font-weight:800;padding:9px 12px;border-radius:12px;cursor:pointer;font:inherit;font-size:14px}
.sheet{position:fixed;inset:0;background:rgba(23,20,10,.45);display:flex;align-items:flex-end;justify-content:center;z-index:20}.sheet[hidden]{display:none}
.shbox{background:var(--card);width:100%;max-width:480px;border-radius:22px 22px 0 0;padding:18px 16px calc(16px + env(safe-area-inset-bottom))}
.shbox h3{margin:0 0 10px;font-size:18px}.shbox label{display:block;font-size:13.5px;font-weight:700;margin-top:10px}.shbox input{width:100%;margin-top:4px;border:1.5px solid var(--line);border-radius:12px;padding:11px 12px;font:inherit}
.ob{display:flex;gap:8px;margin-top:14px}.ob .vbtn{flex:1;margin:0;text-align:center}.ghost{border:1px solid var(--line);background:none;border-radius:12px;padding:10px 14px;font-weight:700;cursor:pointer}
.msg{color:#b42318;font-weight:700;margin:8px 0 0}.okmsg{background:#e8f6ee;color:#1f6b3a;font-weight:700;border-radius:12px;padding:10px 12px;margin-top:10px}
</style></head><body>
<div class="hero"><div class="top"><img src="/logo-64.png" alt=""><b>${esc(brand)}</b><nav class="lang">${langs}</nav></div>
<h1>${esc(g.apt)}</h1><small>${esc(T.hello)} · ${esc(T.guide)}</small>${chips ? `<div class="chips">${chips}</div>` : ""}</div>
<main>${secs.join("") || `<div class="empty">${esc(T.empty)}</div>`}<footer>${esc(brand)} · espace.md</footer></main>
<script>
const T=${JSON.stringify({ need: T.need, err: T.err, order: T.order })}, GTOK=${JSON.stringify(token)};
let SID="";
const $=id=>document.getElementById(id);
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-order],#o-x,#o-go"); if(!b){if(e.target===$("sh"))$("sh").hidden=true;return}
  if(b.id==="o-x"){$("sh").hidden=true;return}
  if(b.dataset.order){SID=b.dataset.order;$("sh-t").textContent=b.dataset.name||T.order;$("o-err").hidden=true;$("sh").hidden=false;setTimeout(()=>$("o-name").focus(),40);return}
  if(b.id==="o-go"){(async()=>{
    const name=$("o-name").value.trim(),phone=$("o-phone").value.trim(),note=$("o-note").value.trim(),err=$("o-err");
    if(!name||!phone){err.textContent=T.need;err.hidden=false;return}
    b.disabled=true;try{
      const r=await fetch("/api/pub_svc_order",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({gtoken:GTOK,service_id:SID,name,phone,note})});
      if(!r.ok)throw 0;$("sh").hidden=true;$("o-ok").hidden=false;b.disabled=false;
    }catch(x){b.disabled=false;err.textContent=T.err;err.hidden=false}
  })()}
});
</script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
};
