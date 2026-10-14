// espace.md service worker: push notifications + "opens like an app" when the network drops.
// Pages: network first, the last good copy when offline. Icons/logo: cache first. The API is never cached.
const CACHE = "espace-shell-v1";
const STATIC = ["/icon-192.png", "/icon-512.png", "/icon-180.png", "/icon.svg", "/logo-64.png", "/manifest.webmanifest"];
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)).catch(() => {})); });
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
const OFFLINE = `<!doctype html><html lang="ro"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>espace.md</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f9;font:16px system-ui,sans-serif;color:#1b1f3b;text-align:center;padding:24px">
<div><img src="/icon-192.png" width="64" height="64" alt="" style="border-radius:16px"><h1 style="font-size:20px;margin:16px 0 6px">Nu e internet</h1><p style="color:#6b7084;margin:0 0 18px">Нет интернета · No connection</p>
<button onclick="location.reload()" style="border:0;border-radius:8px;background:#2e3192;color:#fff;font:600 15px system-ui;padding:12px 22px">Încearcă din nou</button></div></body></html>`;
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url); if (u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  if (r.mode === "navigate") {
    e.respondWith((async () => {
      try { const res = await fetch(r); if (res.ok) { const c = await caches.open(CACHE); c.put(r, res.clone()); } return res; }
      catch (_) { return (await caches.match(r)) || (await caches.match(r, { ignoreSearch: true })) || new Response(OFFLINE, { headers: { "content-type": "text/html; charset=utf-8" } }); }
    })());
    return;
  }
  if (STATIC.includes(u.pathname)) e.respondWith(caches.match(r).then((m) => m || fetch(r)));
});
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "espace.md", {
    body: d.body || "", icon: "/icon-192.png", badge: "/icon-192.png", tag: d.tag || undefined, renotify: !!d.tag, silent: false, vibrate: [120, 60, 120], data: { url: d.url || "/" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || "/");
  }));
});
