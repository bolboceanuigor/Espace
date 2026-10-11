// Router for espace.md and every *.espace.md subdomain.
// Cloudflare Pages cannot take a wildcard custom domain, so this Worker sits on the routes
// espace.md/* and *.espace.md/* and forwards each request to the Pages project,
// telling it the real host in x-espace-host (functions/_middleware.ts decides what to show).
interface Env { PAGES_ORIGIN: string }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, env.PAGES_ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("x-espace-host", url.host);
    const init: RequestInit = { method: request.method, headers, redirect: "manual" };
    if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;
    const res = await fetch(target.toString(), init);
    // keep redirects on the visitor's own host
    const loc = res.headers.get("location");
    if (loc && loc.startsWith(env.PAGES_ORIGIN)) {
      const h = new Headers(res.headers);
      h.set("location", "https://" + url.host + loc.slice(env.PAGES_ORIGIN.length));
      return new Response(res.body, { status: res.status, headers: h });
    }
    return res;
  },
};
