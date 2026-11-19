// Notifications to the native apps: iPhone through Apple (APNs), Android through Google (FCM v1).
// Keys are Cloudflare secrets set from GitHub: APNS_KEY (.p8 text), APNS_KEY_ID, APPLE_TEAM_ID, FCM_SERVICE_ACCOUNT (Firebase service-account JSON).
// Without them nothing is sent and nothing breaks: web push and the bell work as before.
import { type Env, run } from "./core";

const TOPIC = "md.espace.app";
const b64u = (b: ArrayBuffer | Uint8Array | string) => {
  const u = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer);
  let s = ""; for (const x of u) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const der = (pem: string) => Uint8Array.from(atob(pem.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));

let apnsJwt = { t: "", at: 0 };
async function apnsAuth(env: Env) {
  if (apnsJwt.t && Date.now() - apnsJwt.at < 40 * 60e3) return apnsJwt.t;
  const key = await crypto.subtle.importKey("pkcs8", der(env.APNS_KEY!), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const unsigned = b64u(JSON.stringify({ alg: "ES256", kid: env.APNS_KEY_ID })) + "." + b64u(JSON.stringify({ iss: env.APPLE_TEAM_ID, iat: Math.floor(Date.now() / 1000) }));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  apnsJwt = { t: unsigned + "." + b64u(sig), at: Date.now() };
  return apnsJwt.t;
}
let fcmTok: { t: string; exp: number } | null = null;
async function fcmAccess(sa: any) {
  if (fcmTok && fcmTok.exp > Date.now() + 60e3) return fcmTok.t;
  const key = await crypto.subtle.importKey("pkcs8", der(String(sa.private_key)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = b64u(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + body)));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + head + "." + body + "." + sig });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || "fcm oauth " + r.status);
  fcmTok = { t: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return fcmTok.t;
}
const fcmSa = (env: Env) => { try { const s = JSON.parse(env.FCM_SERVICE_ACCOUNT || ""); return s && s.private_key && s.project_id ? s : null; } catch { return null; } };
export const nativeReady = (env: Env) => ({ ios: !!(env.APNS_KEY && env.APNS_KEY_ID && env.APPLE_TEAM_ID), android: !!fcmSa(env) });

/** Send one notification to the given phones; tokens Apple / Google reject are deleted. */
export async function sendNative(env: Env, db: D1Database, rows: any[], msg: { title: string; body?: string; tag?: string }) {
  const ok = nativeReady(env);
  const drop = (t: string) => run(db, "DELETE FROM native_tokens WHERE token = ?", t).catch(() => {});
  const sa = ok.android ? fcmSa(env) : null;
  await Promise.all(rows.map(async (x: any) => {
    try {
      if (x.platform === "ios" && ok.ios) {
        const send = async (sb: boolean) => fetch(`https://api${sb ? ".sandbox" : ""}.push.apple.com/3/device/${x.token}`, {
          method: "POST",
          headers: { authorization: "bearer " + (await apnsAuth(env)), "apns-topic": TOPIC, "apns-push-type": "alert", "apns-priority": "10" },
          body: JSON.stringify({ aps: { alert: { title: msg.title, body: msg.body || "" }, sound: "default", "thread-id": msg.tag || "espace" }, url: "/" }),
        });
        let r = await send(!!x.sb);
        if (r.status === 400) {
          const why = String(((await r.json().catch(() => ({}))) as any).reason || "");
          if (why === "BadDeviceToken") { const r2 = await send(!x.sb); if (r2.ok) { await run(db, "UPDATE native_tokens SET sb = ? WHERE token = ?", x.sb ? 0 : 1, x.token); return; } r = r2; }
          await drop(x.token); return;
        }
        if (r.status === 410) await drop(x.token);
      } else if (x.platform === "android" && sa) {
        const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: "POST", headers: { authorization: "Bearer " + (await fcmAccess(sa)), "content-type": "application/json" },
          body: JSON.stringify({ message: { token: x.token, notification: { title: msg.title, body: msg.body || "" }, data: { url: "/" },
            android: { priority: "high", notification: { sound: "default", tag: msg.tag || undefined } } } }),
        });
        if (r.status === 404 || (r.status === 400 && /UNREGISTERED|INVALID_ARGUMENT/.test(await r.text()))) await drop(x.token);
      }
    } catch {}
  }));
}
/** Save (or move) a phone's token. */
export async function saveNative(db: D1Database, O: string, b: any, userId: string, staffId: string) {
  const token = String(b?.token || "").slice(0, 400), platform = b?.platform === "android" ? "android" : b?.platform === "ios" ? "ios" : "";
  if (!platform || !/^[A-Za-z0-9_:\-]{20,400}$/.test(token)) return false;
  const lang = ["ru", "ro", "en"].includes(b?.lang) ? b.lang : "ru";
  await run(db, `INSERT INTO native_tokens(token, org_id, platform, user_id, staff_id, lang) VALUES (?,?,?,?,?,?)
    ON CONFLICT (token) DO UPDATE SET org_id = excluded.org_id, platform = excluded.platform, user_id = excluded.user_id, staff_id = excluded.staff_id, lang = excluded.lang`,
    token, O, platform, userId, staffId, lang);
  return true;
}
