const CACHE_NAME = 'guessly-v2'
const CORE_ASSETS = [
  './manifest.webmanifest',
  './pwa-64x64.png',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './maskable-icon-512x512.png',
  './apple-touch-icon-180x180.png',
]

const scopedUrl = (path) => new URL(path, self.registration.scope).toString()

const cacheAppShell = async () => {
  const rootUrl = scopedUrl('./')
  const response = await fetch(rootUrl, { cache: 'no-cache' })
  const html = await response.clone().text()
  const linkedAssets = Array.from(
    html.matchAll(/(?:src|href)="([^"]+)"/g),
    (match) => new URL(match[1], rootUrl).toString(),
  ).filter((url) => new URL(url).origin === self.location.origin)
  const cache = await caches.open(CACHE_NAME)
  const assets = [...new Set([...CORE_ASSETS.map(scopedUrl), ...linkedAssets])]

  await cache.put(rootUrl, response)
  await cache.addAll(assets)
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(scopedUrl('./'), response.clone())
          return response
        })
        .catch(() => caches.match(scopedUrl('./'))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) {
        return cached
      }

      const response = await fetch(request)
      if (response.ok && new URL(request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME)
        await cache.put(request, response.clone())
      }
      return response
    }),
  )
})