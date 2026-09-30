/** The `?mode=` lanes of the DB-free stamp harness. Plain module so the server page can validate the query without touching client code. */
export const STAMP_HARNESS_MODES = [
  "success",
  "final",
  // The final stamp lands but the server issued no reward behind it.
  "final-pending",
  "blocked",
  "unknown",
  "unknown-issued",
  "unknown-issued-bonus",
  "unknown-closed",
  "closed",
  "reloaded-final",
  "location-blocked",
  "code-rejected",
  "code-locked",
  // A visit that must confirm location (visit three onwards, check on).
  "verify-grace-spent",
  "verify-grace-left",
  "verify-located",
  "verify-out-of-range",
  "verify-rate-limited",
  "verify-code-locked",
  "verify-code-throttled",
  // The next stamp time is unknown (the venue's day start could not be read):
  // the quiet line falls back to "on your next visit".
  "success-next-visit",
  "closed-next-visit",
] as const

export type HarnessMode = (typeof STAMP_HARNESS_MODES)[number]

export function isStampHarnessMode(value: string): value is HarnessMode {
  return (STAMP_HARNESS_MODES as readonly string[]).includes(value)
}

/**
 * Stamp outcomes that land on the card page instead of the stamp screen, so
 * the harness mounts the real card surface for them:
 *
 * - `unmatched-missing` / `unmatched-venue`: S6, the stamp link had no venue
 *   QR, or a QR from another venue.
 * - `first-stamp-rescan` / `first-stamp-retry` / `first-stamp-venue`: S8, the
 *   card was saved on joining but the first stamp did not land, with each
 *   recovery the server can offer.
 */
export const STAMP_HARNESS_CARD_MODES = [
  "unmatched-missing",
  "unmatched-venue",
  "first-stamp-rescan",
  "first-stamp-retry",
  "first-stamp-venue",
] as const

export type StampHarnessCardMode = (typeof STAMP_HARNESS_CARD_MODES)[number]

export function isStampHarnessCardMode(
  value: string
): value is StampHarnessCardMode {
  return (STAMP_HARNESS_CARD_MODES as readonly string[]).includes(value)
}
