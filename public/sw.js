// Denizcilik Sözlüğü - Tam Çevrimdışı (Offline-First) Service Worker
const CACHE_NAME = 'denizcilik-sozlugu-v30';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icon.svg',
  '/anchor-icon.jpg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/shared-terms.json',
];

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);

  // Cache each core asset individually so one failure never blocks the others
  await Promise.allSettled(
    CORE_ASSETS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res && res.ok) {
          await cache.put(url, res);
        }
      } catch {
        // ignore if offline
      }
    })
  );

  // Parse index.html and cache all referenced JS/CSS/module assets
  try {
    const res = await fetch('/index.html', { cache: 'reload' });
    if (res && res.ok) {
      const copyForIndex = res.clone();
      const copyForRoot = res.clone();
      const html = await res.text();

      await cache.put('/index.html', copyForIndex);
      await cache.put('/', copyForRoot);

      // Match /assets/... or /src/... href/src attributes in index.html
      const attrRegex = /(?:src|href)=["'](\/(?:assets|src)\/[^"']+)["']/g;
      const urlsToCache = new Set();
      let match;
      while ((match = attrRegex.exec(html)) !== null) {
        if (match[1]) urlsToCache.add(match[1]);
      }

      await Promise.allSettled(
        Array.from(urlsToCache).map(async (assetUrl) => {
          try {
            const assetRes = await fetch(assetUrl, { cache: 'reload' });
            if (assetRes && assetRes.ok) {
              await cache.put(assetUrl, assetRes);
            }
          } catch {
            // ignore
          }
        })
      );
    }
  } catch {
    // ignore if offline
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(precacheAppShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Client sends all loaded performance resource URLs so 100% of JS/CSS/chunks are cached for offline use
  if (event.data.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
    const urls = event.data.urls;
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        await Promise.allSettled(
          urls.map(async (rawUrl) => {
            try {
              const u = new URL(rawUrl, self.location.origin);
              if (u.origin !== self.location.origin) return;
              if (u.pathname.startsWith('/api/')) return;
              const existing = await cache.match(u.href);
              if (!existing) {
                const res = await fetch(u.href);
                if (res && res.ok) {
                  await cache.put(u.href, res);
                }
              }
            } catch {
              // ignore
            }
          })
        );
      })
    );
  }
});

function fetchWithTimeout(request, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Network timeout'));
    }, timeoutMs);

    fetch(request)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function findInCache(request) {
  const exact = await caches.match(request);
  if (exact) return exact;
  const ignoreSearch = await caches.match(request, { ignoreSearch: true });
  if (ignoreSearch) return ignoreSearch;
  return null;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Let browser handle email approval links and TTS audio directly
  if (
    url.pathname.startsWith('/api/pending-terms/email-action') ||
    url.pathname.startsWith('/api/tts')
  ) {
    return;
  }

  // API endpoints and shared-terms.json: always fetch fresh from network first (no-store) so startup gets latest updates immediately
  if (url.pathname.startsWith('/api/') || url.pathname === '/shared-terms.json') {
    event.respondWith(
      fetchWithTimeout(new Request(event.request, { cache: 'no-store' }), 3500)
        .then((res) => {
          if (res && res.ok && (url.pathname.startsWith('/api/shared-terms') || url.pathname === '/shared-terms.json')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await findInCache(event.request);
          if (cached) return cached;
          return new Response(JSON.stringify({ ok: false, offline: true, terms: [], pending: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }

  // 1. HTML Navigation requests (opening the app online or offline)
  const acceptHeader = event.request.headers.get('accept') || '';
  const isNavigation =
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    acceptHeader.includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetchWithTimeout(event.request, 3000)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copyForReq = networkResponse.clone();
            const copyForRoot = networkResponse.clone();
            const copyForIndex = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copyForReq);
              cache.put('/', copyForRoot);
              cache.put('/index.html', copyForIndex);
            });
            return networkResponse;
          }
          throw new Error('Bad navigation response');
        })
        .catch(async () => {
          const cachedNav =
            (await findInCache(event.request)) ||
            (await caches.match('/index.html', { ignoreSearch: true })) ||
            (await caches.match('/', { ignoreSearch: true }));
          if (cachedNav) return cachedNav;
          return new Response(
            '<!doctype html><html><head><meta charset="utf-8"><title>Denizcilik Sözlüğü</title></head><body>Uygulama çevrimdışı önbelleği hazırlanıyor, lütfen bir kez internete bağlıyken sayfayı yenileyin.</body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 2. Hashed static bundles (/assets/*) and images/icons: Cache-First with background update!
  // This makes the app open INSTANTLY offline and online.
  const isImmutableAsset =
    url.pathname.startsWith('/assets/') ||
    /\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$/i.test(url.pathname);

  if (isImmutableAsset) {
    event.respondWith(
      findInCache(event.request).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return res;
          })
          .catch(() => null);

        if (cached) {
          return cached;
        }
        return networkFetch.then((res) => res || new Response('', { status: 503 }));
      })
    );
    return;
  }

  // 3. Other JS/TS/CSS/JSON files (e.g. Vite dev modules or manifest.json):
  // Try network with short timeout, fallback to cache immediately if offline
  event.respondWith(
    fetchWithTimeout(event.request, 3000)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await findInCache(event.request);
        if (cached) return cached;
        return new Response('', { status: 503 });
      })
  );
});
