// The espace.md Telegram bot: a manager opens t.me/<bot>?start=<code> from the app, the bot links that chat to
// the person and company, and from then on the app's notifications for managers also arrive in Telegram.
import { type Env, all, one, run, randCode, sha256hex, nowIso } from "./core";

const api = (env: Env, method: string, body: any) =>
  fetch(`${env.TELEGRAM_API || "https://api.telegram.org"}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch(() => ({ ok: false }));

export async function botName(env: Env, db: D1Database) {
  if (!env.TELEGRAM_BOT_TOKEN) return "";
  const c = await one(db, "SELECT v FROM sys_state WHERE k = 'tg_bot'");
  if (c?.v) return c.v;
  const r: any = await api(env, "getMe", {});
  const name = r?.result?.username || "";
  if (name) await run(db, "INSERT INTO sys_state(k, v) VALUES ('tg_bot', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v", name);
  return name;
}

export async function linkCode(db: D1Database, orgId: string, userId: string) {
  const code = randCode(10);
  await run(db, "DELETE FROM tg_codes WHERE expires_at < ?", nowIso());
  await run(db, "INSERT INTO tg_codes(code, org_id, user_id, expires_at) VALUES (?,?,?,?)", code, orgId, userId, new Date(Date.now() + 30 * 60000).toISOString());
  return code;
}

// the secret Telegram sends back with every update (set by the deploy workflow from CRON_KEY)
export async function webhookSecret(env: Env) { return env.CRON_KEY ? (await sha256hex(env.CRON_KEY)).slice(0, 32) : ""; }

export async function handleUpdate(env: Env, db: D1Database, u: any) {
  const m = u?.message; if (!m?.chat?.id || typeof m.text !== "string") return;
  const chat = String(m.chat.id), text = m.text.trim();
  const reply = (t: string) => api(env, "sendMessage", { chat_id: chat, text: t, parse_mode: "HTML", disable_web_page_preview: true });
  const start = /^\/start(?:\s+([A-Za-z0-9]{6,20}))?/.exec(text);
  if (start && start[1]) {
    const c = await one(db, "SELECT * FROM tg_codes WHERE code = ? AND expires_at > ?", start[1], nowIso());
    if (!c) { await reply("Linkul a expirat. Deschide din nou espace.md → Setări → Notificări → Telegram.\nСсылка устарела — откройте её заново в приложении."); return; }
    await run(db, "DELETE FROM tg_codes WHERE code = ?", c.code);
    await run(db, "INSERT OR IGNORE INTO tg_links(org_id, user_id, chat_id, name) VALUES (?,?,?,?)", c.org_id, c.user_id, chat, [m.from?.first_name, m.from?.last_name].filter(Boolean).join(" ").slice(0, 60));
    const o = await one(db, "SELECT name FROM orgs WHERE id = ?", c.org_id);
    await reply(`✅ Gata! Aici vor veni notificările pentru <b>${esc(o?.name || "")}</b>: rezervări noi, cereri, curățenii, reparații.\nГотово! Уведомления для <b>${esc(o?.name || "")}</b> будут приходить сюда.\n\n/stop — oprește / отключить`);
    return;
  }
  if (/^\/stop/.test(text)) {
    await run(db, "DELETE FROM tg_links WHERE chat_id = ?", chat);
    await reply("Notificările au fost oprite. / Уведомления отключены.");
    return;
  }
  await reply("Acesta e botul espace.md pentru notificări. Conectează-l din aplicație: Setări → Notificări → Telegram.\nЭто бот уведомлений espace.md. Подключите его в приложении: Настройки → Уведомления → Telegram.");
}

// managers' notifications for a company → every linked chat of its owners/managers/checkers
export async function tgNotify(env: Env, db: D1Database, orgId: string, msg: { title: string; body?: string }) {
  if (!env.TELEGRAM_BOT_TOKEN) return 0;
  const chats = await all(db, `SELECT DISTINCT t.chat_id FROM tg_links t JOIN members m ON m.org_id = t.org_id AND m.user_id = t.user_id
    WHERE t.org_id = ? AND m.role IN ('owner', 'manager', 'checker')`, orgId);
  const text = `<b>${esc(msg.title)}</b>${msg.body ? "\n" + esc(msg.body) : ""}`;
  for (const c of chats) {
    const r: any = await api(env, "sendMessage", { chat_id: c.chat_id, text, parse_mode: "HTML", disable_web_page_preview: true });
    if (r && r.ok === false && (r.error_code === 403 || r.error_code === 400)) await run(db, "DELETE FROM tg_links WHERE chat_id = ?", c.chat_id); // blocked the bot
  }
  return chats.length;
}

const esc = (s: string) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } as any)[c]);
