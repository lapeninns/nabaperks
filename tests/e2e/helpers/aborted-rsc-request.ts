// WebKit reports a Next.js router (RSC) prefetch that a navigation cancels as an
// uncaught "…/<path>?_rsc=<id> due to access control checks." page error. The
// ID-check journey only tolerates that for the merchant console links the
// router prefetches in the background; a blocked request for any page the
// journey actually opens, or the same wording from another browser, still
// fails the test.
const INCIDENTAL_PREFETCH_PATHS = new Set([
  "/app",
  "/app/activity",
  "/app/numbers",
])

const ACCESS_CONTROL_SUFFIX = /(\S+) due to access control checks\.?$/

function requestPath(message: string) {
  const target = ACCESS_CONTROL_SUFFIX.exec(message)?.[1]
  if (!target) return undefined
  // WebKit prints either a full URL or "/<host>/<path>"; drop scheme and host.
  const hostAndPath = target.replace(/^[a-z]+:/i, "").replace(/^\/+/, "")
  const slash = hostAndPath.indexOf("/")
  if (slash < 0) return undefined
  const url = new URL(hostAndPath.slice(slash), "http://prefetch.invalid")
  const params = [...url.searchParams.keys()]
  if (params.length !== 1 || params[0] !== "_rsc") return undefined
  return url.pathname
}

export function isIncidentalAbortedPrefetch(
  message: string,
  browserName: string
): boolean {
  if (browserName !== "webkit") return false
  const path = requestPath(message)
  return path !== undefined && INCIDENTAL_PREFETCH_PATHS.has(path)
}
