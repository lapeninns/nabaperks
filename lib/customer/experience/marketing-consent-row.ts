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
 *
 * Which channels a wallet may choose is decided here too, so the profile shows
 * only the toggles the server accepts: a verified phone for text and WhatsApp,
 * a verified email for email, and a venue membership to record the choice
 * against (QA BUG-033, BUG-034, BUG-035). A channel the wallet is already
 * opted in to stays offered so it can be turned off.
 */
import type { MarketingChannel } from "@/lib/customer/consent"

export type MarketingConsentEligibility = {
  hasVerifiedPhone: boolean
  hasVerifiedEmail: boolean
  membershipCount: number
}

/** Why a marketing change was not recorded. */
export type MarketingConsentRefusal =
  "needs_verified_phone" | "needs_verified_email" | "no_memberships"

export type DisplayMarketingChannel = Exclude<MarketingChannel, "push">

/**
 * The server rule for one toggle. Opting out of a channel is always allowed
 * while the wallet has a venue; opting in needs the verified contact for that
 * channel. Consent is recorded per venue membership, so a wallet with none has
 * nowhere to record it.
 */
export function marketingConsentRefusal({
  channel,
  optedIn,
  eligibility,
}: {
  channel: MarketingChannel
  optedIn: boolean
  eligibility: MarketingConsentEligibility
}): MarketingConsentRefusal | null {
  if (eligibility.membershipCount < 1) return "no_memberships"
  if (!optedIn) return null
  if (
    (channel === "sms" || channel === "whatsapp") &&
    !eligibility.hasVerifiedPhone
  ) {
    return "needs_verified_phone"
  }
  if (channel === "email" && !eligibility.hasVerifiedEmail) {
    return "needs_verified_email"
  }
  return null
}

export const MARKETING_CONSENT_REFUSAL_NOTICE: Record<
  MarketingConsentRefusal,
  string
> = {
  needs_verified_phone:
    "Add a phone number first to get offers by text or WhatsApp.",
  needs_verified_email: "Confirm your email first to get offers by email.",
  no_memberships:
    "Join a venue first. You choose updates when you join and can change them here afterwards.",
}

/**
 * The toggles the profile offers. Unknown eligibility (null fields) keeps the
 * toggle, and the server still refuses what the wallet cannot choose.
 */
export function marketingConsentChannels({
  hasVerifiedPhone,
  hasVerifiedEmail,
  membershipCount,
}: {
  hasVerifiedPhone: boolean
  hasVerifiedEmail: boolean | null
  membershipCount: number | null
}): { channels: DisplayMarketingChannel[]; notice: string | null } {
  if (membershipCount === 0) {
    return {
      channels: [],
      notice: MARKETING_CONSENT_REFUSAL_NOTICE.no_memberships,
    }
  }
  const channels: DisplayMarketingChannel[] = []
  if (hasVerifiedEmail !== false) channels.push("email")
  if (hasVerifiedPhone) channels.push("sms", "whatsapp")
  if (channels.length === 0) {
    return {
      channels,
      notice:
        "Confirm your email or add a phone number to choose updates from your venues.",
    }
  }
  return { channels, notice: null }
}

const DISPLAY_CHANNEL_ORDER: readonly DisplayMarketingChannel[] = [
  "email",
  "sms",
  "whatsapp",
]

/** Why a standing opt-in can be turned off but not back on. */
export const MARKETING_CONSENT_WITHDRAW_ONLY_NOTICE = {
  email:
    "Your email is not confirmed, so you can only turn email updates off. Confirm an email address to turn them on again.",
  phone:
    "Your phone number is not verified, so you can only turn text and WhatsApp updates off. Add your phone number to turn them on again.",
} as const

/**
 * The toggles the profile offers, including withdrawal. A wallet can always
 * turn off a channel it is opted in to, even without the verified contact
 * that opting in needs: the pre-fix join and profile recorded email opt-ins
 * for unconfirmed or absent emails, and text or WhatsApp opt-ins for staged
 * phones (QA BUG-033, BUG-034). Such a channel is offered withdraw-only; the
 * server refuses turning it back on until the contact is verified.
 */
export function marketingConsentOffer({
  hasVerifiedPhone,
  hasVerifiedEmail,
  membershipCount,
  optedInByChannel,
}: {
  hasVerifiedPhone: boolean
  hasVerifiedEmail: boolean | null
  membershipCount: number | null
  optedInByChannel: Partial<Record<DisplayMarketingChannel, boolean>>
}): {
  channels: DisplayMarketingChannel[]
  withdrawOnly: DisplayMarketingChannel[]
  notices: string[]
  notice: string | null
} {
  const offered = marketingConsentChannels({
    hasVerifiedPhone,
    hasVerifiedEmail,
    membershipCount,
  })
  const withdrawOnly =
    membershipCount === 0
      ? []
      : DISPLAY_CHANNEL_ORDER.filter(
          (channel) =>
            !offered.channels.includes(channel) &&
            optedInByChannel[channel] === true
        )
  if (withdrawOnly.length === 0) {
    return { ...offered, withdrawOnly, notices: [] }
  }
  const notices: string[] = []
  if (withdrawOnly.includes("email")) {
    notices.push(MARKETING_CONSENT_WITHDRAW_ONLY_NOTICE.email)
  }
  if (withdrawOnly.some((channel) => channel !== "email")) {
    notices.push(MARKETING_CONSENT_WITHDRAW_ONLY_NOTICE.phone)
  }
  return {
    channels: DISPLAY_CHANNEL_ORDER.filter(
      (channel) =>
        offered.channels.includes(channel) || withdrawOnly.includes(channel)
    ),
    withdrawOnly,
    notices,
    notice: null,
  }
}

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
    /** Why the change was not recorded. */
    refusal?: MarketingConsentRefusal
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

  if (state.refusal) {
    return {
      checked,
      message: MARKETING_CONSENT_REFUSAL_NOTICE[state.refusal] ?? "",
    }
  }
  if (state.error) return { checked, message: "Couldn't save — try again" }
  if (typeof state.optedIn === "boolean") return { checked, message: "Saved" }
  return { checked, message: "" }
}
