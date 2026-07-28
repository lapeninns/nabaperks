const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])
const PRODUCTION_HOSTS = new Set([
  "nabaperks.com",
  "www.nabaperks.com",
  "nabaperks.vercel.app",
])

export function resolveSafeLoadTarget({
  urls,
  mode = "local",
  isolatedStagingOrigin = "",
  isolatedStagingConfirmed = "",
}) {
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error("at least one load target URL is required")
  }

  const parsed = urls.map((raw) => parseHttpUrl(raw))
  for (const url of parsed) {
    if (PRODUCTION_HOSTS.has(url.hostname.toLowerCase())) {
      throw new Error(`refusing to load-test production host "${url.hostname}"`)
    }
  }

  const origins = new Set(parsed.map((url) => url.origin))
  if (origins.size !== 1) {
    throw new Error("all load-test URLs must use the same origin")
  }

  const origin = parsed[0].origin
  if (mode === "local") {
    if (
      !parsed.every((url) => LOOPBACK_HOSTS.has(url.hostname.toLowerCase()))
    ) {
      throw new Error("local load tests require loopback targets")
    }
  } else if (mode === "isolated-staging") {
    if (isolatedStagingConfirmed !== "1") {
      throw new Error(
        "isolated staging load tests require explicit confirmation"
      )
    }
    const allowlisted = parseHttpUrl(isolatedStagingOrigin)
    if (allowlisted.pathname !== "/") {
      throw new Error("isolated staging allowlist must be an origin")
    }
    if (origin !== allowlisted.origin) {
      throw new Error(
        "load target is not the allowlisted isolated staging origin"
      )
    }
    if (allowlisted.protocol !== "https:") {
      throw new Error("isolated staging load tests require HTTPS")
    }
    if (!allowlisted.hostname.endsWith(".vercel.app")) {
      throw new Error(
        "isolated staging must use an immutable Vercel deployment origin"
      )
    }
  } else {
    throw new Error("LOAD_TARGET_MODE must be local or isolated-staging")
  }

  return { mode, origin }
}

export function assertLoadEnvironment(payload, mode) {
  if (!payload || typeof payload !== "object") {
    throw new Error("load target health payload is invalid")
  }
  if (mode === "isolated-staging") {
    if (payload.targetEnvironment !== "staging") {
      throw new Error("load target did not identify as isolated staging")
    }
    if (payload.environment === "production") {
      throw new Error("refusing to load-test a production environment")
    }
  }
}

function parseHttpUrl(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error("load target URL is invalid")
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("load target URL must use HTTP or HTTPS")
  }
  if (url.username || url.password) {
    throw new Error("load target URL must not contain credentials")
  }
  return url
}
