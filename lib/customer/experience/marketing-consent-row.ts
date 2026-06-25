/**
 * Per-row state for a global marketing-consent toggle on the /home profile.
 *
 * Each channel posts on change (no Save button). Two friction fixes live here so
 * the component stays declarative and this logic can be triangulated directly:
 *
 *  - Feedback: the toggle gives a quiet, polite confirmation ("Saved") once a save
 *    lands, and a warning ("Couldn't save — try again") when it fails — instead of
 *    only a transient disabled dim.
 *  - Control/state sync: the checkbox is controlled from server truth, not left
 *    uncontrolled (defaultChecked). The action returns the standing value — the new
 *    value on success, the reverted prior value on failure — so on a failed save the
 *    visible switch snaps back and agrees with the message rather than contradicting
 *    it.
 *
 * A row only reacts to an action result addressed to its own channel; another
 * channel's result is ignored and the standing value holds. Empty message = say
 * nothing, so the live region is silent on mount and while a save is in flight.
 */
import type { MarketingChannel } from "@/lib/customer/consent"

export type MarketingConsentRowState = {
  /** Whether this channel's action result is for me. */
  channel: "email" | "sms" | "whatsapp"
  /** The standing server value for this channel at render time. */
  optedIn: boolean
  /** This row's action is mid-flight (request not yet resolved). */
  pending: boolean
  /**
   * The latest action result (may be empty, or for another channel). Accepts the
   * full marketing-channel union the server action echoes (incl. "push"); a result
   * for a channel this row doesn't render simply never matches and is ignored.
   */
  state: {
    channel?: MarketingChannel
    optedIn?: boolean
    error?: string
  }
}

export type MarketingConsentRowView = {
  /** Controlled checkbox value, reflected from server truth. */
  checked: boolean
  /** Polite live-region text; empty string means stay silent. */
  message: string
}

export function marketingConsentRowState({
  channel,
  optedIn,
  pending,
  state,
}: MarketingConsentRowState): MarketingConsentRowView {
  const isMine = state.channel === channel
  // The action echoes the standing value (new on success, reverted on failure),
  // so the switch always agrees with the outcome.
  const checked =
    isMine && typeof state.optedIn === "boolean" ? state.optedIn : optedIn

  if (pending || !isMine) return { checked, message: "" }

  if (state.error) return { checked, message: "Couldn't save — try again" }
  if (typeof state.optedIn === "boolean") return { checked, message: "Saved" }
  return { checked, message: "" }
}
