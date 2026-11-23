// Offline support: keep a copy of the app files; show the saved copy at once, refresh it in the background.
// Bump VERSION on every deploy so phones pick up the new files.
const VERSION = 'fm-v1';
const FILES = [
  './', 'index.html', 'app.css', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/icon-180.png',
  'js/main.js', 'js/app.js', 'js/store.js', 'js/science.js', 'js/foods.js', 'js/workouts.js', 'js/notes.js',
  'js/ui.js', 'js/icons.js', 'js/chart.js',
  'js/views/today.js', 'js/views/progress.js', 'js/views/gym.js', 'js/views/food.js',
  'js/views/checkin.js', 'js/views/settings.js', 'js/views/science.js', 'js/views/setup.js',
  'data/exercises.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || fresh;
  }));
});
