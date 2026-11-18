const CACHE = 'ostalos-experience-v20';
const CORE = ['./', './index.html', './app.js?v=28', './content.js?v=11', './styles.css?v=16', './experience.css?v=20', './memory-world.js?v=5', './memory-plates.js?v=2', './memory-images.js?v=7', './memory-composer.js?v=3', './flight.js?v=2', './dying-frame.js?v=2', './ascent.js?v=7', './space-scene.js?v=3', './assets/three.min.js', './assets/star-catalog.js?v=1', './assets/space-art.jpg', './assets/space-finale.jpg', './assets/milky-way-real-4k.jpg', './assets/photographic/variety.json?v=1'];
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
