/**
 * Pure formatter for the redeemed-reward proof line.
 *
 * The redeemed-proof panel confirms the reward was collected; this adds the
 * quiet receipt detail of *when* and *where*, from the server-confirmed
 * `reward_events.redeemed_at`. Kept pure (and unit-tested) so the panel stays a
 * thin renderer. Voice: plain en-GB, no emoji, no exclamation marks.
 */

const redeemedProofFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/London",
})

/**
 * "Collected 19 Jun 2026, 11:05 · The Old Crown", or "" when there is no
 * timestamp (so the panel never shows "Invalid Date").
 */
export function formatRedeemedProofLine(
  redeemedAtIso: string | null | undefined,
  venueName: string
): string {
  if (!redeemedAtIso) return ""

  const when = new Date(redeemedAtIso)
  if (Number.isNaN(when.getTime())) return ""

  const stamp = redeemedProofFormatter.format(when)
  return `Collected ${stamp} · ${venueName}`
}
