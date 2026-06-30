/**
 * Canonical destinations for the venue-QR surface, plus the origin-aware return
 * helpers shared by the QR server actions.
 *
 * The same `QrPanel` renders on two shells: the sidebar console at `/app/qr`
 * (the steady-state "Poster" home) and the focused setup flow at
 * `/app/launch?tab=qr`. Each shell posts its own path as a hidden `returnTo`
 * field so the QR actions return the merchant to the shell they acted from
 * instead of always bouncing them to the setup chrome (which drops the
 * sidebar).
 *
 * `returnTo` is user-controllable, so actions must resolve it through
 * {@link resolveQrReturnBase}, which only ever returns an allowlisted internal
 * path — the raw value is never reflected into a redirect, so there is no
 * open-redirect surface.
 */
export const QR_POSTER_PATH = "/app/qr"
export const QR_LAUNCH_TAB_PATH = "/app/launch?tab=qr"

const QR_RETURN_ALLOWLIST: ReadonlySet<string> = new Set([
  QR_POSTER_PATH,
  QR_LAUNCH_TAB_PATH,
])

/** Resolve a posted `returnTo` value to an allowlisted base path. */
export function resolveQrReturnBase(value: FormDataEntryValue | null): string {
  return typeof value === "string" && QR_RETURN_ALLOWLIST.has(value)
    ? value
    : QR_LAUNCH_TAB_PATH
}

/**
 * Append a pre-encoded query string to a base that may already carry one
 * (`/app/launch?tab=qr` → `&`, `/app/qr` → `?`).
 */
export function qrReturnHref(base: string, query?: string): string {
  if (!query) return base
  return `${base}${base.includes("?") ? "&" : "?"}${query}`
}
