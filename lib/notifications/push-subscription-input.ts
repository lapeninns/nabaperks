export type PushPermissionState =
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported"
  | "unknown"

export type WebPushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
}

export type ValidSubscriptionResult =
  | { ok: true; subscription: WebPushSubscriptionInput }
  | { ok: false; error: "invalid_subscription" }

const allowedPushEndpointHosts = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
])

export function normalizePermissionState(value: unknown): PushPermissionState {
  if (typeof value !== "string") return "unknown"

  switch (value.trim().toLowerCase()) {
    case "prompt":
      return "prompt"
    case "granted":
      return "granted"
    case "denied":
      return "denied"
    case "unsupported":
      return "unsupported"
    case "unknown":
      return "unknown"
    default:
      return "unknown"
  }
}

export function validatePushSubscriptionInput(
  value: unknown
): ValidSubscriptionResult {
  if (!isRecord(value) || !isRecord(value.keys)) {
    return { ok: false, error: "invalid_subscription" }
  }

  const endpoint = stringValue(value.endpoint).trim()
  const p256dh = stringValue(value.keys.p256dh).trim()
  const auth = stringValue(value.keys.auth).trim()

  if (!isValidEndpoint(endpoint) || p256dh.length < 20 || auth.length < 8) {
    return { ok: false, error: "invalid_subscription" }
  }

  return { ok: true, subscription: { endpoint, p256dh, auth } }
}

export function validatePushEndpoint(value: unknown) {
  const endpoint = stringValue(value).trim()
  return isValidEndpoint(endpoint) ? endpoint : null
}

/**
 * Endpoint from the disable/unsubscribe request bodies, which send either a
 * bare `{ endpoint }` or a full `{ subscription: { endpoint } }` payload.
 */
export function pushEndpointFromBody(value: unknown): unknown {
  if (!isRecord(value)) return null
  if (typeof value.endpoint === "string") return value.endpoint
  return isRecord(value.subscription) ? value.subscription.endpoint : null
}

export function isAllowedWebPushEndpoint(value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      value.length >= 20 &&
      value.length <= 2048 &&
      !url.username &&
      !url.password &&
      !url.hash &&
      isAllowedPushEndpointHost(url.hostname)
    )
  } catch {
    return false
  }
}

function isValidEndpoint(value: string) {
  return isAllowedWebPushEndpoint(value)
}

function isAllowedPushEndpointHost(hostname: string) {
  const host = hostname.toLowerCase()
  return (
    allowedPushEndpointHosts.has(host) || host.endsWith(".notify.windows.com")
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : ""
}
