// TOTP (RFC 6238) + backup codes for espace.md 2FA. Web Crypto only — no heavy OTP libs.

import { encode as qrEncode } from "uqr";
import { randHex, sha256hex, sameStr } from "./core";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, val = 0, out = "";
  for (const b of bytes) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += B32[(val << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Uint8Array {
  const clean = s.replace(/=+$/, "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, val = 0; const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch); if (i < 0) continue;
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

export function newTotpSecret(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

export function otpauthUrl(email: string, secret: string, issuer = "espace.md"): string {
  const label = encodeURIComponent(issuer + ":" + email);
  const q = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${q}`;
}

export function qrSvg(text: string, px = 180): string {
  const { data, size } = qrEncode(text, { ecc: "M" });
  const cell = px / size;
  let rects = "";
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[y][x])
    rects += `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>${rects}</svg>`;
}

async function hmacSha1(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, msg));
}

export async function totpCode(secretB32: string, atMs = Date.now(), step = 30): Promise<string> {
  const key = base32Decode(secretB32);
  const counter = Math.floor(atMs / 1000 / step);
  const buf = new ArrayBuffer(8); new DataView(buf).setUint32(4, counter >>> 0, false);
  const mac = await hmacSha1(key, new Uint8Array(buf));
  const off = mac[mac.length - 1] & 0xf;
  const bin = ((mac[off] & 0x7f) << 24) | ((mac[off + 1] & 0xff) << 16) | ((mac[off + 2] & 0xff) << 8) | (mac[off + 3] & 0xff);
  return String(bin % 1e6).padStart(6, "0");
}

export async function totpOk(secretB32: string, code: string, window = 1): Promise<boolean> {
  const c = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(c) || !secretB32) return false;
  const now = Date.now();
  for (let w = -window; w <= window; w++) {
    if (sameStr(c, await totpCode(secretB32, now + w * 30000))) return true;
  }
  return false;
}

export function newBackupCodes(n = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < n; i++) codes.push(randHex(4).toUpperCase()); // 8 hex chars
  return codes;
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => sha256hex(c.toUpperCase())));
}

export async function consumeBackup(hashesJson: string, code: string): Promise<string[] | null> {
  const c = String(code || "").replace(/[\s-]/g, "").toUpperCase();
  if (!/^[0-9A-F]{8}$/.test(c)) return null;
  let hashes: string[] = [];
  try { hashes = JSON.parse(hashesJson || "[]"); } catch { return null; }
  if (!Array.isArray(hashes)) return null;
  const h = await sha256hex(c);
  const i = hashes.findIndex((x) => sameStr(String(x), h));
  if (i < 0) return null;
  return hashes.filter((_, j) => j !== i);
}
