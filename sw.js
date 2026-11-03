/* RollerKey – Service Worker
   VERSION bei jeder Änderung an index.html hochzählen. */
const VERSION = "rk-21";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon.svg"];
const NET = 8000;

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await Promise.all(SHELL.map(u => {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), NET);
      return c.add(new Request(u, { cache: "reload", signal: ctl.signal }))
        .catch(() => {})
        .finally(() => clearTimeout(t));
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => {
  if (e.data === "skip") e.waitUntil(self.skipWaiting());
  if (e.data === "clear")
    e.waitUntil(caches.keys().then(k => Promise.all(k.map(x => caches.delete(x)))));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;

  if (req.mode === "navigate"){
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r && r.ok && (u.pathname.endsWith("/") || u.pathname.endsWith("/index.html"))){
          const c = await caches.open(VERSION);
          c.put("./index.html", r.clone()).catch(() => {});
        }
        return r;
      } catch(_){
        const c = await caches.open(VERSION);
        return (await c.match("./index.html")) || (await c.match("./")) ||
               new Response("offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(req);
    if (hit){
      fetch(req)
        .then(r => { if (r && r.ok) c.put(req, r.clone()).catch(() => {}) })
        .catch(() => {});
      return hit;
    }
    try {
      const r = await fetch(req);
      if (r && r.ok) c.put(req, r.clone()).catch(() => {});
      return r;
    } catch(_){
      return new Response("offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  })());
});