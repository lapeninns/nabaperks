"use client"

import { useEffect } from "react"

/**
 * Rewrites the address bar to a screen's canonical URL without a navigation.
 *
 * `/q/[qrId]` is the URL printed on the venue QR, and for a returning member it
 * now renders the stamp screen in place instead of bouncing through a 302 to
 * `/card/[membershipId]/stamp?qr=…` — one server render per scan, not two. The
 * canonical address still matters (bookmarks, the login `next` target, the
 * e2e URL contract, `router.refresh()` after a stamp), so it is applied here
 * via `history.replaceState`, which the App Router folds into its own state:
 * a later `router.refresh()` re-fetches the canonical page, never the QR
 * resolver — and so never charges the scan rate limit twice.
 *
 * Same mechanism as {@link CelebrationUrlCleanup}; kept separate because the
 * two have opposite intents (this one *adds* the canonical path, that one
 * strips one-shot params) and should not be reasoned about together.
 */
export function CanonicalUrl({ href }: { href: string }) {
  useEffect(() => {
    const target = new URL(href, window.location.origin)
    if (target.href === window.location.href) return
    // `null`, never `window.history.state`: on a hydrated App Router page the
    // current state carries Next's internal `__NA` marker, and the patched
    // replaceState treats any state bearing it as one of Next's own internal
    // calls and skips the router sync. With a fresh state Next copies its
    // internals in and applies the URL, so usePathname(), the tab bar and
    // router.refresh() all follow to the canonical stamp route.
    window.history.replaceState(null, "", target)
  }, [href])

  return null
}
