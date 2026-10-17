// espace.md — the 5-minute heartbeat. GitHub's scheduled workflows run late (often hours apart),
// so this Cloudflare Worker calls /api/cron on time: Airbnb/Booking calendars, reminders, daily credits and emails.
// /api/cron is safe to call often: credits are taken once per day, emails carry a dedupe key.
export default {
  async scheduled(_ev, env, ctx) {
    ctx.waitUntil(ping(env));
  },
  // open https://espace-cron.<account>.workers.dev/ to see the last answer (no key needed, nothing secret shown)
  async fetch(_req, env) {
    const r = await ping(env);
    return new Response(JSON.stringify(r), { headers: { "content-type": "application/json" } });
  },
};
async function ping(env) {
  if (!env.CRON_KEY) return { ok: false, error: "CRON_KEY missing" };
  const url = (env.APP_URL || "https://espace.md").replace(/\/$/, "") + "/api/cron";
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: env.CRON_KEY }) });
    const body = await r.text();
    if (!r.ok) console.log("cron failed", r.status, body.slice(0, 200));
    return { ok: r.ok, status: r.status, body: body.slice(0, 300) };
  } catch (e) {
    console.log("cron error", String(e));
    return { ok: false, error: String(e) };
  }
}
