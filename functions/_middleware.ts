// Serves the right page for each host (see lib/host.ts). /api and /g are handled by their own functions.
import { hostOf, siteOf } from "../lib/host";

interface Env { DB: D1Database; ASSETS: Fetcher }
const PAGES: Record<string, string> = { site: "/site", admin: "/admin", tenant: "/app" };
const SPLIT = ["/site", "/site.html", "/admin", "/admin.html", "/app", "/app.html", "/app-ro", "/app-ro.html"];

// company app language: the es_lang cookie (set by the RO/RU switch) wins, else the browser's preferred language
export function appLang(req: Request): "ro" | "ru" {
  const c = /(?:^|;\s*)es_lang=(ro|ru)/.exec(req.headers.get("cookie") || "");
  if (c) return c[1] as "ro" | "ru";
  const al = (req.headers.get("accept-language") || "").toLowerCase();
  const ro = al.search(/\b(ro|mo)\b/), ru = al.search(/\bru\b/);
  return ro >= 0 && (ru < 0 || ro < ru) ? "ro" : "ru";
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const p = url.pathname;
  if (p.startsWith("/api/") || p.startsWith("/g/") || p.startsWith("/f/")) return ctx.next();
  const s = siteOf(hostOf(request));
  if (s.kind === "dev") return p === "/" ? env.ASSETS.fetch(new URL("/site", url)) : ctx.next();
  if (s.kind === "www") return Response.redirect("https://espace.md" + p + url.search, 301);
  if (s.kind === "tenant") {
    const org = await env.DB.prepare("SELECT 1 AS x FROM orgs WHERE code = ?").bind(s.slug).first().catch(() => null);
    if (!org) return Response.redirect("https://espace.md/?nu-exista=" + encodeURIComponent(s.slug), 302);
  }
  // each host has exactly one page; the others are not reachable from it
  if (p === "/" || p === "/index.html") {
    const page = s.kind === "tenant" && appLang(request) === "ro" ? "/app-ro" : PAGES[s.kind];
    const r = await env.ASSETS.fetch(new URL(page, url));
    const h = new Headers(r.headers);
    h.set("cache-control", "no-cache");
    if (s.kind === "tenant") h.set("vary", "cookie, accept-language");
    return new Response(r.body, { status: r.status, headers: h });
  }
  if (SPLIT.includes(p)) return Response.redirect("https://" + hostOf(request) + "/", 302);
  return ctx.next();
};
