// Service worker : l'app fonctionne hors-ligne (fichiers de l'app + fonds de carte déjà vus).
const VERSION = 'cdv-v3.7.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'icons/apple-touch-icon.png', 'icons/icon-192.png',
  'vendor/preact.js', 'vendor/maplibre/maplibre-gl.js', 'vendor/maplibre/maplibre-gl.css',
  'vendor/fontawesome/css/fontawesome.min.css', 'vendor/fontawesome/css/solid.min.css', 'vendor/fontawesome/css/regular.min.css',
  'vendor/fontawesome/webfonts/fa-solid-900.woff2', 'vendor/fontawesome/webfonts/fa-regular-400.woff2',
  'js/main.js', 'js/core/app.js', 'js/core/config.js', 'js/core/store.js', 'js/core/lock.js', 'js/core/vault.js', 'js/core/location.js', 'js/core/sharedKeys.js',
  'js/ui/components.js', 'js/ui/dialogs.js', 'js/ui/PinPad.js',
  'js/lib/geo.js', 'js/lib/dates.js', 'js/lib/places.js', 'js/lib/openNow.js', 'js/lib/currency.js', 'js/lib/weather.js',
  'js/lib/photos.js', 'js/lib/google.js', 'js/lib/guide.js', 'js/lib/party.js', 'js/lib/routing.js', 'js/lib/bookingParser.js', 'js/lib/assistant.js', 'js/lib/trips.js',
  'js/data/categories.js', 'js/data/emergency.js', 'js/data/checklistTemplate.js', 'js/data/londonSeed.js',
  'js/views/WelcomeView.js', 'js/views/LoginView.js', 'js/views/PinSetupView.js', 'js/views/LockView.js', 'js/views/TripsView.js',
  'js/views/MapView.js', 'js/views/PlaceView.js', 'js/views/PlannerView.js', 'js/views/VaultView.js', 'js/views/BudgetView.js',
  'js/views/MoreView.js', 'js/views/ChecklistView.js', 'js/views/EmergencyView.js', 'js/views/JournalView.js',
  'js/views/AssistantView.js', 'js/views/SettingsView.js', 'js/views/TravelersView.js',
];
const LAZY = ['vendor/firebase.js', 'vendor/opening_hours.js'];
const TILES = 'cdv-tiles';
const MAX_TILES = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then(async (c) => {
      await c.addAll(SHELL);
      await c.addAll(LAZY).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== TILES).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Carte 3D (style, tuiles, polices, icônes) : cache d'abord, réseau ensuite (consultables hors-ligne).
  if (url.hostname === 'tiles.openfreemap.org') {
    e.respondWith(
      caches.open(TILES).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        try {
          const res = await fetch(e.request);
          if (res.ok || res.type === 'opaque') {
            c.put(e.request, res.clone());
            if (Math.random() < 0.05) trimTiles();
          }
          return res;
        } catch {
          return new Response('', { status: 504 });
        }
      })
    );
    return;
  }

  // Fichiers de l'app : réseau d'abord (mises à jour), cache si hors-ligne.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
    );
  }
});
