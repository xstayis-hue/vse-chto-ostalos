const CACHE = 'ostalos-experience-v24';
const CORE = ['./', './app.js?v=28', './content.js?v=11', './styles.css?v=17', './experience.css?v=19', './memory-plates.js?v=2', './memory-images.js?v=9', './memory-composer.js?v=3', './flight.js?v=2', './dying-frame.js?v=2', './assets/archive-cover.jpg', './icon.svg', './manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ostalos-') && k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Only application resources belong in the offline cache, never development tools.
  const navigation = event.request.mode === 'navigate';
  if (!/\.(js|css|jpg|png|svg|webmanifest)$/.test(url.pathname) && !navigation) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && !navigation && !response.headers.get('content-type')?.includes('text/html')) {
      const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {}));
    }
    return response;
  }).catch(async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(event.request)) || (navigation ? (await cache.match('./')) || Response.error() : Response.error());
  }));
});
