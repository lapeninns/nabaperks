/**
 * Guard a `next` redirect target so customer sign-in links can only ever return
 * to an in-app path. Anything that could leave the origin — a protocol-relative
 * `//evil.test` URL, an absolute `https://…`, or a non-path string — collapses to
 * the customer home. Used to build `/home/login?next=…` recovery links.
 */
export function safeNextPath(path: string): string {
  if (!path.startsWith("/")) return "/home"
  if (path.startsWith("//")) return "/home"
  if (path.startsWith("/\\")) return "/home"
  if (isCustomerAuthPath(path)) return "/home"
  return path
}

/** Build a customer login link that returns to `path` after authentication. */
export function customerLoginHref(path: string): string {
  return `/home/login?next=${encodeURIComponent(safeNextPath(path))}`
}

export function customerSessionResetHref(path: string): string {
  return `/home/session/reset?next=${encodeURIComponent(safeNextPath(path))}`
}

function isCustomerAuthPath(path: string): boolean {
  return (
    isSamePathOrDescendant(path, "/home/login") ||
    isSamePathOrDescendant(path, "/home/session/reset")
  )
}

function isSamePathOrDescendant(path: string, basePath: string): boolean {
  return (
    path === basePath ||
    path.startsWith(`${basePath}?`) ||
    path.startsWith(`${basePath}/`)
  )
}
