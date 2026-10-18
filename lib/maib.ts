// espace.md — card / Apple Pay / Google Pay / MIA through maib e-Commerce Checkout (hosted payment page).
// Docs: https://docs.maibmerchants.md/checkout
// Two uses:
//   1) Platform credit top-ups — secrets from Cloudflare env (MAIB_*).
//   2) Guest booking payments — each company stores its own maib project in cfg.guestMaib
//      (money goes to that company, not to the platform balance).
import type { Env } from "./core";

export const MAIB_PROD = "https://api.maibmerchants.md";
export const MAIB_SANDBOX = "https://sandbox.maibmerchants.md";

export type MaibCfg = {
  ok: boolean;
  base: string;
  sandbox: boolean;
  clientId: string;
  clientSecret: string;
  key: string;
};

export function maibConfig(env: Env): MaibCfg {
  const e = env as any;
  return maibFromCreds({
    clientId: e.MAIB_CLIENT_ID,
    clientSecret: e.MAIB_CLIENT_SECRET,
    signatureKey: e.MAIB_SIGNATURE_KEY,
    sandbox: e.MAIB_SANDBOX === "1" || e.MAIB_SANDBOX === "true",
    baseUrl: e.MAIB_BASE_URL,
  });
}

/** Build a maib client from explicit credentials (per-company guest pay). */
export function maibFromCreds(c: {
  clientId?: unknown;
  clientSecret?: unknown;
  signatureKey?: unknown;
  sandbox?: boolean;
  baseUrl?: unknown;
}): MaibCfg {
  const clientId = String(c.clientId || "").trim();
  const clientSecret = String(c.clientSecret || "").trim();
  const key = String(c.signatureKey || "").trim();
  const ok = !!(clientId && clientSecret && key);
  const base = String(c.baseUrl || (c.sandbox ? MAIB_SANDBOX : MAIB_PROD)).replace(/\/+$/, "");
  return { ok, base, sandbox: base !== MAIB_PROD, clientId, clientSecret, key };
}

async function call(url: string, init: RequestInit) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const t = await r.text(); let j: any = null; try { j = t ? JSON.parse(t) : null; } catch {}
  if (!r.ok || !j || j.ok === false) throw new Error("maib " + r.status + " " + (j?.errors ? JSON.stringify(j.errors).slice(0, 300) : t.slice(0, 300)));
  return j.result ?? j;
}

export async function maibToken(cfg: MaibCfg) {
  const r = await call(cfg.base + "/v2/auth/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: cfg.clientId, clientSecret: cfg.clientSecret }) });
  if (!r.accessToken) throw new Error("maib: no token");
  return String(r.accessToken);
}

export type CheckoutReq = {
  orderId: string; amount: number; description: string; lang: string;
  itemTitle?: string; itemId?: string;
  payer: { name?: string; email?: string; phone?: string; ip?: string; ua?: string };
  callbackUrl: string; successUrl: string; failUrl: string;
};
export async function maibCheckout(cfg: MaibCfg, q: CheckoutReq) {
  const token = await maibToken(cfg);
  const amount = Math.round(q.amount * 100) / 100;
  const title = (q.itemTitle || "Credite espace.md").slice(0, 120);
  const body = {
    amount, currency: "MDL",
    orderInfo: { id: q.orderId, description: q.description.slice(0, 120), date: new Date().toISOString(),
      items: [{ externalId: (q.itemId || "pay").slice(0, 40), title, amount, currency: "MDL", quantity: 1 }] },
    payerInfo: { name: q.payer.name || null, email: q.payer.email || null, phone: q.payer.phone || null, ip: q.payer.ip || null, userAgent: (q.payer.ua || "").slice(0, 200) || null },
    language: ["ro", "ru", "en"].includes(q.lang) ? q.lang : "ro",
    callbackUrl: q.callbackUrl, successUrl: q.successUrl, failUrl: q.failUrl,
  };
  const r = await call(cfg.base + "/v2/checkouts", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token }, body: JSON.stringify(body) });
  if (!r.checkoutUrl) throw new Error("maib: no checkoutUrl");
  return { checkoutId: String(r.checkoutId || ""), checkoutUrl: String(r.checkoutUrl) };
}

const b64 = (buf: ArrayBuffer) => { let s = ""; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s); };
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
function sameStr(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

// true when the callback really comes from maib: HMAC over the exact raw body + "." + timestamp, timestamp no older than 15 minutes
export async function maibVerify(key: string, rawBody: string, sigHeader: string, tsHeader: string, nowMs = Date.now()) {
  const sig = String(sigHeader || "").replace(/^sha256=/i, "").trim(), ts = String(tsHeader || "").trim();
  if (!key || !sig || !/^\d{10,16}$/.test(ts)) return false;
  const tsMs = ts.length <= 10 ? Number(ts) * 1000 : Number(ts);
  if (Math.abs(nowMs - tsMs) > 15 * 60 * 1000) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(rawBody + "." + ts));
  return sameStr(b64(mac), sig) || sameStr(hex(mac), sig.toLowerCase());
}
