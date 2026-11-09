/* Alwiti uren: eenvoudige service worker. Altijd eerst de nieuwste versie van internet;
   zonder verbinding de laatst bekende versie van de app. Gegevens (Google Sheet) gaan er niet doorheen. */
const CACHE = 'alwiti-app-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(r).then(res => {
      if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); }
      return res;
    }).catch(() => caches.match(r).then(m => m || caches.match('./')))
  );
});
