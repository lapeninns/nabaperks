export function safeNextPath(path: string): string {
  return safePath(path, "/home", isCustomerAuthPath)
}

export function customerLoginHref(path: string): string {
  return `/home/login?next=${encodeURIComponent(safeNextPath(path))}`
}

export function safeMerchantNextPath(path: string): string {
  return safePath(path, "/app", isMerchantAuthPath)
}

export function merchantLoginHref(path: string): string {
  return `/login?next=${encodeURIComponent(safeMerchantNextPath(path))}`
}

export function customerSessionResetHref(path: string): string {
  return `/home/session/reset?next=${encodeURIComponent(safeNextPath(path))}`
}

function safePath(
  path: string,
  fallback: string,
  isBlockedPath: (path: string) => boolean
): string {
  if (!path.startsWith("/")) return fallback
  if (path.startsWith("//")) return fallback
  if (path.startsWith("/\\")) return fallback
  if (isBlockedPath(path)) return fallback
  return path
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
    isSamePathOrDescendant(path, "/signup")
  )
}

function isSamePathOrDescendant(path: string, basePath: string): boolean {
  return (
    path === basePath ||
    path.startsWith(`${basePath}?`) ||
    path.startsWith(`${basePath}/`)
  )
}
