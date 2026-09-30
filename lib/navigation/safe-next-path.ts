export function safeNextPath(path: string): string {
  return safePath(path, "/home", isCustomerAuthPath)
}

export function customerLoginHref(path: string): string {
  return `/home/login?next=${encodeURIComponent(safeNextPath(path))}`
}

export function safeMerchantNextPath(path: string, fallback = "/app"): string {
  return safePath(path, fallback, isMerchantAuthPath)
}

export function merchantLoginHref(path: string): string {
  return `/login?next=${encodeURIComponent(safeMerchantNextPath(path))}`
}

export function customerSessionResetHref(path: string): string {
  return `/home/session/reset?next=${encodeURIComponent(safeNextPath(path))}`
}

const SAFE_PATH_ORIGIN = "https://nabaperks.local"
const CONTROL_OR_WHITESPACE = /[\u0000-\u001f\u007f\s]/

function safePath(
  path: string,
  fallback: string,
  isBlockedPath: (path: string) => boolean
): string {
  if (CONTROL_OR_WHITESPACE.test(path)) return fallback
  if (!isSingleSlashPath(path)) return fallback

  let parsed: URL
  try {
    parsed = new URL(path, SAFE_PATH_ORIGIN)
  } catch {
    return fallback
  }

  if (parsed.origin !== SAFE_PATH_ORIGIN) return fallback

  const safePathname = `${parsed.pathname}${parsed.search}${parsed.hash}`
  // URL parsing collapses dot segments, so `/..//host` becomes `//host`.
  // Re-check the normalised result before a browser can read it as a host.
  if (!isSingleSlashPath(safePathname)) return fallback
  if (isBlockedPath(safePathname)) return fallback
  return safePathname
}

/** A root-relative path: one `/` that is not followed by `/` or `\`. */
function isSingleSlashPath(path: string): boolean {
  return path.startsWith("/") && path[1] !== "/" && path[1] !== "\\"
}

function isCustomerAuthPath(path: string): boolean {
  return (
    isSamePathOrDescendant(path, "/home/login") ||
    isSamePathOrDescendant(path, "/home/session/reset")
  )
}

function isMerchantAuthPath(path: string): boolean {
  return (
    isSamePathOrDescendant(path, "/login") ||
    isSamePathOrDescendant(path, "/reset-password") ||
    isSamePathOrDescendant(path, "/auth/confirm") ||
    isSamePathOrDescendant(path, "/signup/verify") ||
    isSamePathOrDescendant(path, "/signup")
  )
}

function isSamePathOrDescendant(path: string, basePath: string): boolean {
  return (
    path === basePath ||
    path.startsWith(`${basePath}?`) ||
    path.startsWith(`${basePath}#`) ||
    path.startsWith(`${basePath}/`)
  )
}
