// Which part of espace.md a request is for, decided by the host name:
//   espace.md              → the marketing site
//   admin.espace.md        → the platform owner's panel
//   <company>.espace.md    → that company's app (e.g. rentwill.espace.md)
//   anything else (*.pages.dev, localhost) → "dev": every page reachable by path, company from ?c=
// Requests for *.espace.md reach Pages through the router Worker, which passes the real host in x-espace-host.

export const ROOT = "espace.md";
export const RESERVED = new Set([
  "admin", "www", "app", "api", "mail", "smtp", "imap", "pop", "ftp", "static", "cdn", "assets", "img", "media",
  "help", "support", "docs", "blog", "status", "dev", "test", "staging", "demo", "login", "signup", "register",
  "billing", "pay", "dashboard", "panel", "espace", "root", "ns1", "ns2", "g",
]);
export type Site = { kind: "site" } | { kind: "www" } | { kind: "admin" } | { kind: "tenant"; slug: string } | { kind: "dev" };

export function hostOf(req: Request) {
  const h = req.headers.get("x-espace-host") || new URL(req.url).host;
  return h.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}
export function siteOf(host: string): Site {
  if (host === ROOT) return { kind: "site" };
  if (host.endsWith("." + ROOT)) {
    const sub = host.slice(0, -(ROOT.length + 1));
    if (sub === "www") return { kind: "www" };
    if (sub === "admin") return { kind: "admin" };
    if (isSlug(sub)) return { kind: "tenant", slug: sub };
    return { kind: "www" };
  }
  return { kind: "dev" };
}
// a company's address: 3–30 characters, latin letters, digits and hyphens, not at the ends
export const isSlug = (s: string) => /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/.test(s) && !s.includes("--");
export const slugOk = (s: string) => isSlug(s) && !RESERVED.has(s);
