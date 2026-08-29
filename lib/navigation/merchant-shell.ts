/**
 * Route predicates that pick the merchant `/app` shell chrome.
 *
 * These are consumed on the client by {@link MerchantAppShell} via
 * `usePathname()` so the chrome re-derives on every navigation. The shell is
 * hosted by a single shared server layout (`app/app/layout.tsx`) which the App
 * Router preserves across soft navigations — it does NOT re-render per route —
 * so the shell must NOT depend on a server-computed, request-time value to
 * decide which variant to show. Keep these pure and framework-free.
 */

export function isMerchantSetupPath(path: string): boolean {
  return path === "/app/onboarding" || path.startsWith("/app/onboarding/")
}

/** Every print preview (poster, table tent, NFC card, NFC plate) is a full-bleed
 *  surface that carries its own sticky header — `PosterPreviewChrome` or the
 *  sheet host's own `.qr-poster-chrome`. Only the poster prefix used to be
 *  listed, so the three sibling routes stacked the shell's mobile header on top
 *  of their own and scaled their sheet against a viewport the shell had already
 *  eaten. Suppress the shell's mobile header + bottom tab bar for all four. */
const PRINT_PREVIEW_PREFIXES = [
  "/app/qr/poster/",
  "/app/qr/tent/",
  "/app/qr/nfc/",
  "/app/qr/nfc-square/",
] as const

export function isPosterPrintPath(path: string): boolean {
  return PRINT_PREVIEW_PREFIXES.some((prefix) => path.startsWith(prefix))
}

/** Strip query/hash before route predicates run. */
export function normalizeMerchantPath(path: string): string {
  return path.split(/[?#]/, 1)[0] ?? path
}

/** Show the compact setup reminder on merchant console routes except launch/onboarding. */
export function shouldShowMerchantSetupReminder(path: string): boolean {
  const normalized = normalizeMerchantPath(path)

  if (!normalized.startsWith("/app")) {
    return false
  }

  if (isMerchantSetupPath(normalized)) {
    return false
  }

  if (normalized === "/app/launch" || normalized.startsWith("/app/launch/")) {
    return false
  }

  if (isPosterPrintPath(normalized)) {
    return false
  }

  return true
}
