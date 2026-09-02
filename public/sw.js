/* LocalFlow CRM service worker — lean app-shell cache.
 * Vite emits content-hashed assets (index-ABC123.js), so a stale file can never
 * be served for a new build; cache-first for assets is safe. Navigations are
 * network-first so new deploys are picked up immediately, falling back to the
 * cached shell for offline use. Supabase API calls are never cached.
 */
const CACHE_NAME = 'localflow-shell-v1'
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

const ASSET_RE = /\.(js|css|woff2?|png|svg|webp|ico)$/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // SPA navigations: network-first, fall back to cached shell (offline).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
          return res
        })
        .catch(() =>
          caches.match('/index.html').then((cached) => cached || caches.match('/'))
        )
    )
    return
  }

  // Static assets: cache-first, populate as they are requested.
  if (ASSET_RE.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok && CACHE_NAME) {
              const copy = res.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
            }
            return res
          })
      )
    )
  }
})