import {
  persistentCookieOptions,
  type PersistentCookieOptions,
} from "@/lib/http/persistent-cookie-options"

export type FixedExpiryCookieOptions = Omit<PersistentCookieOptions, "maxAge">

/**
 * Options for the customer device and session cookies: one
 * absolute Expires date, computed once, and no Max-Age.
 *
 * iOS Safari keeps a cookie across process death only when it has an absolute
 * Expires (see persistent-cookie-options.ts), so Expires is the attribute to
 * keep. Max-Age is dropped because Next.js recomputes Expires from it each
 * time a cookie is set on a response: when a page redirects, the Proxy's
 * cookie is serialised again at render time, and a render that crosses a
 * wall-clock second sent the same cookie twice with Expires one second apart
 * (QA BUG-067). With Expires alone both serialisations are byte-identical and
 * Next sends one line.
 */
export function fixedExpiryCookieOptions(
  ttlSeconds: number,
  nowMs: number = Date.now()
): FixedExpiryCookieOptions {
  const { httpOnly, sameSite, secure, path, expires } = persistentCookieOptions(
    ttlSeconds,
    nowMs
  )
  return { httpOnly, sameSite, secure, path, expires }
}
