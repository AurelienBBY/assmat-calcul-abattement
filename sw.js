/* ============================================================================
   sw.js — Service worker (PWA)
   ----------------------------------------------------------------------------
   Stratégie « réseau d'abord, cache en secours » :
   - en ligne : toujours la dernière version (mise à jour instantanée au push),
     et chaque réponse rafraîchit le cache ;
   - hors ligne : l'app entière est servie depuis le cache.
   Aucune donnée utilisateur ne transite ici — uniquement les fichiers de l'app.
   ========================================================================== */

const CACHE = "abmat-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return resp;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
