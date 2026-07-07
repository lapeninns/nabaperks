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

/** The poster print preview is a full-bleed surface that carries its own header
 *  (PosterPreviewChrome). Suppress the shell's mobile header + bottom tab bar so
 *  they don't double-stack or occlude the scaled A4 sheet on phones. */
export function isPosterPrintPath(path: string): boolean {
  return path.startsWith("/app/qr/poster/")
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
