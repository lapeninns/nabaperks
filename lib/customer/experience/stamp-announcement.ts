/**
 * The polite live-region text for the self-service stamp mechanic. Stamping is
 * the product's core action, but its progress lives in motion (the slam, the
 * charging ring) and a static grid `aria-label` that ARIA never re-announces —
 * so a screen-reader or reduced-motion customer hears nothing while a stamp is
 * in flight and never learns the new count. This pure function is the single
 * source of that announcement, kept out of the component so it can be triangulated
 * directly. Empty string = say nothing (idle), so the region is silent on mount.
 */
export type StampAnnouncementArgs = {
  /** Optimistic stamp shown, server not yet confirmed. */
  inFlight: boolean
  /** Server confirmed the stamp (the RPC returned "issued"). */
  committed: boolean
  /** Stamps now on the card, including the one that just landed. */
  displayCurrent: number
  total: number
  /** The landed stamp filled the final slot. */
  cardComplete: boolean
}

export function stampAnnouncement({
  inFlight,
  committed,
  displayCurrent,
  total,
  cardComplete,
}: StampAnnouncementArgs): string {
  if (committed) {
    return cardComplete
      ? "Stamp added. That's the full card, your reward is unlocked."
      : `Stamp added. That's ${displayCurrent} of ${total}.`
  }
  if (inFlight) return "Adding your stamp."
  return ""
}
