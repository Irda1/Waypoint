/* Waypoint · service worker de la version web.
   Stratégie : réseau d'abord pour les pages (une mise à jour publiée arrive tout de suite),
   cache en secours hors ligne ; polices Google en « cache puis mise à jour ».
   __WAYPOINT_BUILD__ est remplacé au build : chaque publication vide l'ancien cache. */
const CACHE = "waypoint-__WAYPOINT_BUILD__";
const BASE = ["./", "index.html", "installer.html", "pwa.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/logo.svg", "icons/favicon-32.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k.startsWith("waypoint-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Polices : cache puis rafraîchissement en arrière-plan.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const enCache = await c.match(req);
      const reseau = fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => enCache);
      return enCache || reseau;
    }));
    return;
  }

  // Autres origines (Google Maps, GitHub…) : on ne s'en mêle pas.
  if (url.origin !== self.location.origin) return;

  // Même origine : réseau d'abord, cache en secours.
  e.respondWith(
    fetch(req)
      .then((r) => {
        if (r.ok) { const copie = r.clone(); caches.open(CACHE).then((c) => c.put(req, copie)); }
        return r;
      })
      .catch(async () => (await caches.match(req, { ignoreSearch: true })) ||
        (req.mode === "navigate" ? caches.match("index.html") : Response.error()))
  );
});
