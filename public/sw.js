// Push-only worker. The installable app shell and offline cache have been
// removed. This file stays at /sw.js so browsers that already registered the
// old worker update in place, drop those caches, and stop intercepting
// navigations. Web Push still needs a service worker.
const DEFAULT_NOTIFICATION_TITLE = "Nabaperks"
const DEFAULT_NOTIFICATION_URL = "/home"
const SUBSCRIPTION_PUBLIC_KEY_URL = "/api/notifications/push/public-key"
const SUBSCRIPTION_REFRESH_URL = "/api/notifications/push/refresh"
const SUBSCRIPTION_DISABLE_URL = "/api/notifications/push/disable"
const RETIRED_PWA_CACHE_PREFIX = "nabaperks-pwa-"

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(clearRetiredPwaCaches().then(() => self.clients.claim()))
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

async function clearRetiredPwaCaches() {
  const cacheNames = await caches.keys()
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith(RETIRED_PWA_CACHE_PREFIX))
      .map((cacheName) => caches.delete(cacheName))
  )
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
