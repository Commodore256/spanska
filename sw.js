// Service worker: gör att appen fungerar offline.
// Versionen kommer från version.js och räknas upp av publicera.bat.
// När den ändras laddar enheterna ner den nya versionen.
importScripts("version.js");
const CACHE = "spanska-v" + APP_VERSION;
const FILES = [
  "./",
  "./index.html",
  "./version.js",
  "./config.js",
  "./style.css",
  "./app.js",
  "./words.js",
  "./verbs.js",
  "./adventure.js",
  "./sync.js",
  "./mascot.js",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

// Installera: hämta ALLA filer på nytt direkt från servern (förbi webbläsarens cache).
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" }))))
  );
  self.skipWaiting();
});

// Aktivera: ta bort gamla versioners cache.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Nätverket först, och alltid kontrollera med servern att filen är färsk
// (GitHub Pages låter annars webbläsaren använda gamla filer i 10 minuter).
// Är du offline används cachen.
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req.url, { cache: "no-cache" })
      .then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return resp;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
