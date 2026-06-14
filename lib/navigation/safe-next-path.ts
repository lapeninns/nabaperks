/**
 * Guard a `next` redirect target so wallet sign-in links can only ever return to
 * an in-app path. Anything that could leave the origin — a protocol-relative
 * `//evil.test` URL, an absolute `https://…`, or a non-path string — collapses to
 * the wallet home. Used to build `/wallet/login?next=…` recovery links.
 */
export function safeNextPath(path: string): string {
  if (!path.startsWith("/")) return "/wallet"
  if (path.startsWith("//")) return "/wallet"
  if (path.startsWith("/\\")) return "/wallet"
  return path
}

/** Build a wallet login link that returns to `path` after authentication. */
export function walletLoginHref(path: string): string {
  return `/wallet/login?next=${encodeURIComponent(safeNextPath(path))}`
}
