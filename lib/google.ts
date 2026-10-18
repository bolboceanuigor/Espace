// Google OpenID Connect for espace.md: start URL, code exchange, id_token verify (JWKS).
// No heavy SDK — fetch + Web Crypto. Secrets: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (Igor only).
import { type Env, nowIso, one, run, randHex, str, isEmail } from "./core";
import { hostOf, siteOf } from "./host";

const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export type GoogleProfile = { sub: string; email: string; email_verified: boolean; name: string; picture: string };
export type OAuthMode = "login" | "signup" | "link";
export type OAuthState = {
  mode: OAuthMode;
  slug?: string;
  org_name?: string;
  name?: string;
  terms?: boolean;
  user_id?: string;
  next?: string; // "admin" | ""
  return_to?: string; // absolute URL to land on after success
};

export function googleOk(env: Env) {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/** Fixed production redirect hosts so every company subdomain does not need its own Google URI. */
export function googleRedirectUri(request: Request) {
  const h = hostOf(request), site = siteOf(h), origin = new URL(request.url).origin;
  if (site.kind === "dev") return origin + "/api/google/callback";
  if (site.kind === "admin") return "https://admin.espace.md/api/google/callback";
  return "https://espace.md/api/google/callback";
}

export function googleAuthUrl(env: Env, redirectUri: string, state: string) {
  const u = new URL(AUTH_URL);
  u.searchParams.set("client_id", env.GOOGLE_CLIENT_ID!);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("access_type", "online");
  u.searchParams.set("prompt", "select_account");
  return u.toString();
}

export async function saveOAuthState(db: D1Database, data: OAuthState) {
  const state = randHex(24);
  await run(db, "DELETE FROM oauth_states WHERE expires_at < ?", nowIso()).catch(() => {});
  await run(db, "INSERT INTO oauth_states(state, data, expires_at) VALUES (?,?,?)",
    state, JSON.stringify(data), new Date(Date.now() + 15 * 60000).toISOString());
  return state;
}

export async function takeOAuthState(db: D1Database, state: string): Promise<OAuthState | null> {
  if (!/^[0-9a-f]{48}$/.test(state)) return null;
  const r = await one(db, "DELETE FROM oauth_states WHERE state = ? AND expires_at >= ? RETURNING data", state, nowIso());
  if (!r) return null;
  try { return JSON.parse(r.data) as OAuthState; } catch { return null; }
}

export async function exchangeCode(env: Env, code: string, redirectUri: string) {
  const body = new URLSearchParams({
    code, client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri, grant_type: "authorization_code",
  });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  const j: any = await r.json().catch(() => null);
  if (!r.ok || !j?.id_token) throw new Error("token_exchange");
  return String(j.id_token);
}

let jwksCache: { at: number; keys: any[] } | null = null;
async function googleJwks() {
  if (jwksCache && Date.now() - jwksCache.at < 3600000) return jwksCache.keys;
  const r = await fetch(JWKS_URL, { cf: { cacheTtl: 3600 } } as any);
  const j: any = await r.json();
  if (!r.ok || !Array.isArray(j?.keys)) throw new Error("jwks");
  jwksCache = { at: Date.now(), keys: j.keys };
  return j.keys;
}

function b64urlToBytes(s: string) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importJwk(jwk: any) {
  return crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
}

export async function verifyIdToken(env: Env, idToken: string): Promise<GoogleProfile> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("bad_jwt");
  const [hB, pB, sB] = parts;
  const header: any = JSON.parse(new TextDecoder().decode(b64urlToBytes(hB)));
  const payload: any = JSON.parse(new TextDecoder().decode(b64urlToBytes(pB)));
  if (header.alg !== "RS256" || !header.kid) throw new Error("bad_alg");
  if (!ISSUERS.includes(String(payload.iss || ""))) throw new Error("bad_iss");
  if (payload.aud !== env.GOOGLE_CLIENT_ID) throw new Error("bad_aud");
  const exp = Number(payload.exp) || 0;
  if (exp * 1000 < Date.now() - 60000) throw new Error("expired");
  const keys = await googleJwks();
  const jwk = keys.find((k: any) => k.kid === header.kid);
  if (!jwk) throw new Error("no_key");
  const ok = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, await importJwk(jwk), b64urlToBytes(sB), new TextEncoder().encode(hB + "." + pB));
  if (!ok) throw new Error("bad_sig");
  const email = str(payload.email, 120).toLowerCase();
  const sub = str(payload.sub, 128);
  if (!sub || !isEmail(email)) throw new Error("bad_profile");
  if (payload.email_verified !== true && payload.email_verified !== "true") throw new Error("email_unverified");
  return { sub, email, email_verified: true, name: str(payload.name, 60) || email.split("@")[0], picture: str(payload.picture, 500) };
}
