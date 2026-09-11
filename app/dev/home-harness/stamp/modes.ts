/** The `?mode=` lanes of the DB-free stamp harness. Plain module so the server page can validate the query without touching client code. */
export const STAMP_HARNESS_MODES = [
  "success",
  "final",
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
  "verify-rate-limited",
  "verify-code-locked",
  "verify-code-throttled",
] as const

export type HarnessMode = (typeof STAMP_HARNESS_MODES)[number]

export function isStampHarnessMode(value: string): value is HarnessMode {
  return (STAMP_HARNESS_MODES as readonly string[]).includes(value)
}
