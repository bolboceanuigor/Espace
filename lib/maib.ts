// espace.md — card / Apple Pay / Google Pay / MIA top-ups through maib e-Commerce Checkout (hosted payment page).
// Docs: https://docs.maibmerchants.md/checkout
//   POST {base}/v2/auth/token {clientId, clientSecret} → result.accessToken
//   POST {base}/v2/checkouts (Bearer) → result.checkoutId, result.checkoutUrl
//   callback: POST to our callbackUrl, headers X-Signature: "sha256=<base64 HMAC-SHA256(rawBody + "." + timestamp, signatureKey)>"
//             and X-Signature-Timestamp (ms); body has orderId, paymentId, paymentStatus ("Executed" | "Failed"), amount, currency…
// Secrets (Cloudflare Pages / GitHub): MAIB_CLIENT_ID, MAIB_CLIENT_SECRET, MAIB_SIGNATURE_KEY; MAIB_SANDBOX=1 for the test environment.
import type { Env } from "./core";

export const MAIB_PROD = "https://api.maibmerchants.md";
export const MAIB_SANDBOX = "https://sandbox.maibmerchants.md";

export function maibConfig(env: Env) {
  const e = env as any;
  const ok = !!(e.MAIB_CLIENT_ID && e.MAIB_CLIENT_SECRET && e.MAIB_SIGNATURE_KEY);
  const base = String(e.MAIB_BASE_URL || (e.MAIB_SANDBOX === "1" || e.MAIB_SANDBOX === "true" ? MAIB_SANDBOX : MAIB_PROD)).replace(/\/+$/, "");
  return { ok, base, sandbox: base !== MAIB_PROD, clientId: String(e.MAIB_CLIENT_ID || ""), clientSecret: String(e.MAIB_CLIENT_SECRET || ""), key: String(e.MAIB_SIGNATURE_KEY || "") };
}

async function call(url: string, init: RequestInit) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const t = await r.text(); let j: any = null; try { j = t ? JSON.parse(t) : null; } catch {}
  if (!r.ok || !j || j.ok === false) throw new Error("maib " + r.status + " " + (j?.errors ? JSON.stringify(j.errors).slice(0, 300) : t.slice(0, 300)));
  return j.result ?? j;
}

export async function maibToken(cfg: ReturnType<typeof maibConfig>) {
  const r = await call(cfg.base + "/v2/auth/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: cfg.clientId, clientSecret: cfg.clientSecret }) });
  if (!r.accessToken) throw new Error("maib: no token");
  return String(r.accessToken);
}

export type CheckoutReq = {
  orderId: string; amount: number; description: string; lang: string;
  payer: { name?: string; email?: string; phone?: string; ip?: string; ua?: string };
  callbackUrl: string; successUrl: string; failUrl: string;
};
export async function maibCheckout(cfg: ReturnType<typeof maibConfig>, q: CheckoutReq) {
  const token = await maibToken(cfg);
  const amount = Math.round(q.amount * 100) / 100;
  const body = {
    amount, currency: "MDL",
    orderInfo: { id: q.orderId, description: q.description.slice(0, 120), date: new Date().toISOString(),
      items: [{ externalId: "credits", title: "Credite espace.md", amount, currency: "MDL", quantity: 1 }] },
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
