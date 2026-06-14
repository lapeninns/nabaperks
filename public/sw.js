const CACHE_NAME = "nabaperks-pwa-v1"
const OFFLINE_URL = "/offline"
const STATIC_ASSET_PATHS = [
  OFFLINE_URL,
  "/icons/nabaperks-icon-192.png",
  "/icons/nabaperks-icon-512.png",
  "/icons/nabaperks-maskable-192.png",
  "/icons/nabaperks-maskable-512.png",
]
const NETWORK_ONLY_PREFIXES = [
  "/api",
  "/app",
  "/admin",
  "/card",
  "/reward",
  "/q",
  "/m",
  "/wallet",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSET_PATHS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event.request))
    return
  }

  if (STATIC_ASSET_PATHS.includes(url.pathname)) {
    event.respondWith(cacheFirst(event.request))
  }
})

function isServerStatePath(pathname) {
  return NETWORK_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

async function networkFirstNavigation(request) {
  const url = new URL(request.url)

  try {
    return await fetch(request)
  } catch {
    if (isServerStatePath(url.pathname)) {
      return await caches.match(OFFLINE_URL)
    }

    const cached = await caches.match(request)
    return cached ?? (await caches.match(OFFLINE_URL))
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  const cache = await caches.open(CACHE_NAME)
  await cache.put(request, response.clone())
  return response
}
