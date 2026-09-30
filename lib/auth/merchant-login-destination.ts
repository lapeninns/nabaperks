export const MERCHANT_ONBOARDING_PATH = "/app/onboarding"

/**
 * Where /login sends a user who is already signed in.
 *
 * Console pages send a signed-in user with no venue to /login with themselves
 * as `next`. Returning that user to the same page would bounce them straight
 * back, so a console destination other than onboarding goes to onboarding
 * (where /app sends them) until they own a venue. `next` must already be a
 * safe merchant path; anything outside /app is returned unchanged.
 */
export function signedInMerchantLoginDestination(
  next: string,
  ownsVenue: boolean
): string {
  if (ownsVenue || !pointsIntoConsole(next)) return next
  return isOnboardingPath(next) ? next : MERCHANT_ONBOARDING_PATH
}

/** True when a safe merchant path lands inside the /app console. */
export function pointsIntoConsole(next: string): boolean {
  const pathname = pathOf(next)
  return pathname === "/app" || pathname.startsWith("/app/")
}

function isOnboardingPath(next: string): boolean {
  const pathname = pathOf(next)
  return (
    pathname === MERCHANT_ONBOARDING_PATH ||
    pathname.startsWith(`${MERCHANT_ONBOARDING_PATH}/`)
  )
}

function pathOf(next: string): string {
  return next.split(/[?#]/, 1)[0] ?? ""
}
