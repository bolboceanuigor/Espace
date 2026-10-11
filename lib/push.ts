// Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) with WebCrypto only — works in Cloudflare Workers.
const enc = new TextEncoder();
export const b64u = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const ub64u = (s: string) => {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(t + "=".repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
const concat = (...a: Uint8Array[]) => {
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let o = 0; for (const x of a) { out.set(x, o); o += x.length; }
  return out;
};
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bits: number) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, bits));
}

export interface Vapid { jwk: JsonWebKey; pub: string }
export async function newVapid(): Promise<Vapid> {
  const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  return { jwk: (await crypto.subtle.exportKey("jwk", kp.privateKey)) as JsonWebKey, pub: b64u((await crypto.subtle.exportKey("raw", kp.publicKey)) as ArrayBuffer) };
}

export async function vapidHeader(endpoint: string, v: Vapid) {
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:admin@espace.md" })));
  const { key_ops, ext, ...jwk } = v.jwk as any;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + claims));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${v.pub}`;
}

export async function encryptPayload(payload: string, p256dh: string, auth: string) {
  const ua = ub64u(p256dh), authSecret = ub64u(auth);
  const as = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPub = new Uint8Array((await crypto.subtle.exportKey("raw", as.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey } as any, as.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), ua, asPub), 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 128);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 96);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(enc.encode(payload), new Uint8Array([2]))));
  const header = new Uint8Array(16 + 4 + 1 + asPub.length);
  header.set(salt, 0); new DataView(header.buffer).setUint32(16, 4096); header[20] = asPub.length; header.set(asPub, 21);
  return concat(header, ct);
}

export interface Sub { endpoint: string; p256dh: string; auth: string }
/** Sends one push; returns the HTTP status (404/410 = subscription is dead, delete it). */
export async function sendPush(sub: Sub, msg: unknown, v: Vapid): Promise<number> {
  try {
    const body = await encryptPayload(JSON.stringify(msg), sub.p256dh, sub.auth);
    const r = await fetch(sub.endpoint, { method: "POST", body, headers: {
      Authorization: await vapidHeader(sub.endpoint, v), TTL: "86400", Urgency: "high",
      "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream" } });
    return r.status;
  } catch { return 0; }
}
