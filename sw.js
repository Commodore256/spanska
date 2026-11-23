// Service worker: gör att appen fungerar offline.
// Höj versionen när du ändrar filerna, så laddas den nya versionen ner.
const CACHE = "spanska-v1";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./words.js",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Nätverket först (så du alltid får senaste versionen), cachen om du är offline.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(event.request, copy));
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
