const CACHE = 'radios-consulta-v2';
const ASSETS = [
  './',
  './index.html',
  './consulta.js',
  './consulta.css',
  './styles.css',
  './features.css',
  './logo-fix.css',
  './manifest.webmanifest',
  './logo.png'
];

self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
));

self.addEventListener('activate', event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('radios-consulta-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', event => {
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(response => response || fetch(event.request)));
});
