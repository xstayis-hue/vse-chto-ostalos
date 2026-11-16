const CACHE = 'ostalos-experience-v3';
const CORE = ['./', './index.html', './app.js?v=14', './content.js?v=7', './styles.css?v=13', './experience.css?v=2', './memory-world.js?v=2', './memory-images.js?v=3', './memory-composer.js?v=2', './flight.js?v=2', './ascent.js?v=5', './assets/three.min.js'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ostalos-') && k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Only application resources belong in the offline cache, never development tools.
  if (!/\.(js|css|jpg|png|svg|webmanifest)$/.test(url.pathname) && !event.request.mode.includes('navigate')) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
