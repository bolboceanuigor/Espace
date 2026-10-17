// Serves the right page for each host (see lib/host.ts). /api and /g are handled by their own functions.
import { hostOf, siteOf } from "../lib/host";

interface Env { DB: D1Database; ASSETS: Fetcher }
const PAGES: Record<string, string> = { site: "/site", admin: "/admin", tenant: "/app" };
const SPLIT = ["/site", "/site.html", "/admin", "/admin.html", "/app", "/app.html", "/app-ro", "/app-ro.html", "/app-en", "/app-en.html", "/book", "/book.html", "/raport", "/raport.html", "/contract", "/contract.html", "/checkin", "/checkin.html"];

// company app language: the es_lang cookie (set by the RO/RU/EN switch) wins, else the browser's first known language, else Romanian
export type Lang = "ro" | "ru" | "en";
export function appLang(req: Request): Lang {
  const c = /(?:^|;\s*)es_lang=(ro|ru|en)/.exec(req.headers.get("cookie") || "");
  if (c) return c[1] as Lang;
  for (const part of (req.headers.get("accept-language") || "").toLowerCase().split(",")) {
    const code = part.trim().slice(0, 2);
    if (code === "ro" || code === "mo") return "ro";
    if (code === "ru") return "ru";
    if (code === "en") return "en";
  }
  return "ro";
}
const APP_PAGE: Record<Lang, string> = { ro: "/app-ro", ru: "/app", en: "/app-en" };

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const p = url.pathname;
  if (p.startsWith("/api/") || p.startsWith("/g/") || p.startsWith("/f/") || p.startsWith("/ical/")) return ctx.next();
  const s = siteOf(hostOf(request));
  if (s.kind === "dev") return p === "/" ? env.ASSETS.fetch(new URL("/site", url)) : ctx.next();
  if (s.kind === "www") return Response.redirect("https://espace.md" + p + url.search, 301);
  if (s.kind === "tenant") {
    const org = await env.DB.prepare("SELECT 1 AS x FROM orgs WHERE code = ?").bind(s.slug).first().catch(() => null);
    if (!org) return Response.redirect("https://espace.md/?nu-exista=" + encodeURIComponent(s.slug), 302);
  }
  // each host has exactly one page; the others are not reachable from it
  if (p === "/" || p === "/index.html") {
    const page = s.kind === "tenant" ? APP_PAGE[appLang(request)] : PAGES[s.kind];
    const r = await env.ASSETS.fetch(new URL(page, url));
    const h = new Headers(r.headers);
    h.set("cache-control", "no-cache");
    if (s.kind === "tenant") h.set("vary", "cookie, accept-language");
    return new Response(r.body, { status: r.status, headers: h });
  }
  // a company's direct booking page for guests: <slug>.espace.md/rezerva
  if (s.kind === "tenant" && (p === "/rezerva" || p === "/rezerva/" || p === "/book" || p === "/booking")) {
    const r = await env.ASSETS.fetch(new URL("/book", url));
    const h = new Headers(r.headers); h.set("cache-control", "no-cache");
    return new Response(r.body, { status: r.status, headers: h });
  }
  // a guest's rental contract: <slug>.espace.md/contract/<token>
  if (s.kind === "tenant" && /^\/contract\/[a-f0-9]{32}\/?$/.test(p)) {
    const r = await env.ASSETS.fetch(new URL("/contract", url));
    const h = new Headers(r.headers); h.set("cache-control", "no-cache"); h.set("x-robots-tag", "noindex");
    return new Response(r.body, { status: r.status, headers: h });
  }
  // online check-in: <slug>.espace.md/checkin/<token>
  if (s.kind === "tenant" && /^\/checkin\/[a-f0-9]{32}\/?$/.test(p)) {
    const r = await env.ASSETS.fetch(new URL("/checkin", url));
    const h = new Headers(r.headers); h.set("cache-control", "no-cache"); h.set("x-robots-tag", "noindex");
    return new Response(r.body, { status: r.status, headers: h });
  }
  // an apartment owner's monthly statement: <slug>.espace.md/raport/<token>
  if (s.kind === "tenant" && /^\/raport\/[a-f0-9]{32}\/?$/.test(p)) {
    const r = await env.ASSETS.fetch(new URL("/raport", url));
    const h = new Headers(r.headers); h.set("cache-control", "no-cache"); h.set("x-robots-tag", "noindex");
    return new Response(r.body, { status: r.status, headers: h });
  }
  if (SPLIT.includes(p)) return Response.redirect("https://" + hostOf(request) + "/", 302);
  return ctx.next();
};
