// Bump on offline-shell changes so existing installs re-capture the shell.
const CACHE_NAME = "nabaperks-pwa-v4"
const OFFLINE_URL = "/offline"
const NEXT_STATIC_PREFIX = "/_next/static/"
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
  "/home",
  "/scan",
  "/start",
]
const DEFAULT_NOTIFICATION_TITLE = "Nabaperks"
const DEFAULT_NOTIFICATION_URL = "/home"
const SUBSCRIPTION_PUBLIC_KEY_URL = "/api/notifications/push/public-key"
const SUBSCRIPTION_REFRESH_URL = "/api/notifications/push/refresh"
const SUBSCRIPTION_DISABLE_URL = "/api/notifications/push/disable"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cacheOfflineShell)
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([clearOldCaches(), enableNavigationPreload()]).then(() =>
      self.clients.claim()
    )
  )
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event))
    return
  }

  if (url.pathname.startsWith(NEXT_STATIC_PREFIX)) {
    event.respondWith(cacheFirst(event.request))
    return
  }

  if (STATIC_ASSET_PATHS.includes(url.pathname)) {
    event.respondWith(cacheFirst(event.request))
  }
})

self.addEventListener("push", (event) => {
  event.waitUntil(showPushNotification(event))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(openOrFocusNotificationUrl(event.notification.data?.url))
})

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(refreshPushSubscription(event.oldSubscription))
})

function isServerStatePath(pathname) {
  return NETWORK_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

async function cacheOfflineShell(cache) {
  await cache.addAll(STATIC_ASSET_PATHS)
  const response = await fetch(OFFLINE_URL)
  const html = await response.clone().text()
  await cache.put(OFFLINE_URL, response)
  // Pre-cache the shell's own hashed CSS (plus its fonts below) so the
  // offline page renders on-brand without the network. Script chunks are
  // deliberately NOT captured: hydrating the offline shell while offline
  // arms the dev HMR client's reload-on-disconnect loop, and the primary
  // recovery (the same-URL "Try again" anchor) works unhydrated by design.
  const matches = [
    ...html.matchAll(
      /href="([^"]*\/_next\/static\/(?:css|chunks)\/[^"]+\.css[^"]*)"/g
    ),
  ]
  const paths = [...new Set(matches.map((match) => match[1]))]
  await Promise.all(paths.map((path) => cache.add(path)))
  await cacheShellFonts(cache, paths)
}

// The shell's stylesheets reference the brand fonts; capture them too so the
// offline page keeps its type without the network.
async function cacheShellFonts(cache, shellPaths) {
  const cssPaths = shellPaths.filter((path) => /\.css(?:[?#]|$)/.test(path))
  const fontPaths = new Set()
  await Promise.all(
    cssPaths.map(async (path) => {
      const cached = await cache.match(path)
      if (!cached) return
      const css = await cached.clone().text()
      for (const match of css.matchAll(
        /url\((['"]?)([^'")]*\/_next\/static\/media\/[^'")]+)\1\)/g
      )) {
        fontPaths.add(match[2])
      }
    })
  )
  await Promise.all(
    [...fontPaths].map((path) => cache.add(path).catch(() => undefined))
  )
}

async function clearOldCaches() {
  const cacheNames = await caches.keys()
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName !== CACHE_NAME)
      .map((cacheName) => caches.delete(cacheName))
  )
}

async function enableNavigationPreload() {
  if (!self.registration.navigationPreload) return

  await self.registration.navigationPreload.enable()
}

async function networkFirstNavigation(event) {
  const request = event.request
  const url = new URL(request.url)

  try {
    const preloaded = await event.preloadResponse
    if (preloaded) return preloaded

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

  const url = new URL(request.url)
  if (url.pathname.startsWith(NEXT_STATIC_PREFIX)) {
    // Production assets are content-hashed, so a search variant can safely
    // reuse the same bytes. Next dev assets have stable paths plus a mutable
    // `?v=` build token: serving an older variant there can hydrate new server
    // HTML with stale client code after a restart.
    if (!url.searchParams.has("v")) {
      const variant = await caches.match(request, { ignoreSearch: true })
      if (variant) return variant
    }
  }

  let response
  try {
    response = await fetch(request)
  } catch {
    // Settle deterministically when offline: a hung asset request must never
    // block the page's load event.
    return Response.error()
  }
  // Never cache transient failures: a cached 404/500 on a hashed asset would
  // otherwise persist until the next CACHE_NAME bump.
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(request, response.clone())
  }
  return response
}

async function showPushNotification(event) {
  const payload = parsePushPayload(event)
  const url = safeNotificationUrl(payload.url)

  await self.registration.showNotification(payload.title, {
    body: payload.body,
    badge: payload.badge ?? "/icons/nabaperks-icon-192.png",
    icon: payload.icon ?? "/icons/nabaperks-icon-192.png",
    tag: payload.tag ?? payload.notificationEventId ?? "nabaperks-notification",
    renotify: payload.renotify === true,
    requireInteraction: payload.requireInteraction === true,
    data: {
      notificationEventId: payload.notificationEventId ?? null,
      eventType: payload.eventType ?? null,
      url,
    },
  })
}

function parsePushPayload(event) {
  if (!event.data) {
    return {
      title: DEFAULT_NOTIFICATION_TITLE,
      body: "Your Nabaperks account has an update.",
      url: DEFAULT_NOTIFICATION_URL,
    }
  }

  try {
    const parsed = event.data.json()
    return {
      title: cleanNotificationText(parsed.title, DEFAULT_NOTIFICATION_TITLE),
      body: cleanNotificationText(
        parsed.body,
        "Your Nabaperks account has an update."
      ),
      badge: safeAssetPath(parsed.badge),
      eventType: cleanNotificationText(parsed.eventType, ""),
      icon: safeAssetPath(parsed.icon),
      notificationEventId: cleanNotificationText(
        parsed.notificationEventId,
        ""
      ),
      renotify: parsed.renotify,
      requireInteraction: parsed.requireInteraction,
      tag: cleanNotificationText(parsed.tag, ""),
      url: parsed.url,
    }
  } catch {
    return {
      title: DEFAULT_NOTIFICATION_TITLE,
      body: event.data.text() || "Your Nabaperks account has an update.",
      url: DEFAULT_NOTIFICATION_URL,
    }
  }
}

function cleanNotificationText(value, fallback) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed.slice(0, 180) : fallback
}

function safeAssetPath(value) {
  if (typeof value !== "string") return null
  if (!value.startsWith("/")) return null
  if (value.startsWith("//")) return null
  return value
}

function safeNotificationUrl(value) {
  try {
    const url = new URL(
      typeof value === "string" ? value : DEFAULT_NOTIFICATION_URL,
      self.location.origin
    )
    if (url.origin !== self.location.origin) return DEFAULT_NOTIFICATION_URL
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_NOTIFICATION_URL
  }
}

async function openOrFocusNotificationUrl(value) {
  const url = safeNotificationUrl(value)
  const absoluteUrl = new URL(url, self.location.origin).href
  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  })

  for (const client of windowClients) {
    const clientUrl = new URL(client.url)
    if (clientUrl.href === absoluteUrl && "focus" in client) {
      return client.focus()
    }
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(url)
  }
}

async function refreshPushSubscription(oldSubscription) {
  if (!self.registration.pushManager) return

  try {
    const currentSubscription =
      (await self.registration.pushManager.getSubscription()) ??
      (await subscribeForPush())

    if (!currentSubscription) return

    await fetch(SUBSCRIPTION_REFRESH_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldEndpoint: oldSubscription?.endpoint ?? null,
        subscription: currentSubscription.toJSON(),
      }),
    })
  } catch {
    if (oldSubscription?.endpoint) {
      await fetch(SUBSCRIPTION_DISABLE_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: oldSubscription.endpoint }),
      }).catch(() => undefined)
    }
  }
}

async function subscribeForPush() {
  const response = await fetch(SUBSCRIPTION_PUBLIC_KEY_URL, {
    credentials: "include",
  })
  if (!response.ok) return null

  const { publicKey } = await response.json()
  if (typeof publicKey !== "string" || publicKey.length === 0) return null

  return self.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}
