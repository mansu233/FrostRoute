importScripts('config.js');
const C = 'app-' + APP.version;
const FILES = ['./', 'index.html', 'config.js', 'products.js', 'customers.js', 'orders.js', 'cash.js', 'manifest.json', 'icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))));
  self.clients.claim();
});
// Network first (always the newest files when online), cache as the offline fallback.
// Firebase library files are cached too, so the app opens offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('firestore')) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.status === 200 || r.type === 'opaque') { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
