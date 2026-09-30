import { SectionHeader } from "@/components/brand"
import { CustomerProfileMarketingRows } from "@/components/customer/profile-marketing-consent-rows"
import {
  getMarketingConsentEligibility,
  type MarketingConsentEligibility,
} from "@/lib/customer/consent"
import {
  marketingConsentChannels,
  type DisplayMarketingChannel,
} from "@/lib/customer/experience/marketing-consent-row"

type MarketingConsent = {
  channel: "email" | "sms" | "whatsapp" | "push"
  optedIn: boolean
}

/**
 * Global marketing preferences for the signed-in customer. One toggle per channel
 * applies across every venue. Only the channels the wallet can choose are
 * offered: text and WhatsApp need a verified phone, email needs a verified
 * email, and a wallet with no venue yet is told it chooses updates when it
 * joins (the server refuses the same changes).
 */
export async function CustomerProfileMarketing({
  consents,
  hasPhone = true,
  eligibility,
}: {
  consents: readonly MarketingConsent[]
  /**
   * False for a wallet with no verified phone (for example one started with
   * an email): text and WhatsApp need a phone, so they are not offered.
   */
  hasPhone?: boolean
  /** Loaded for the signed-in wallet when not given. */
  eligibility?: MarketingConsentEligibility | null
}) {
  const wallet =
    eligibility === undefined
      ? await getMarketingConsentEligibility()
      : eligibility
  const { channels, notice } = marketingConsentChannels({
    hasVerifiedPhone: hasPhone && (wallet?.hasVerifiedPhone ?? true),
    hasVerifiedEmail: wallet?.hasVerifiedEmail ?? null,
    membershipCount: wallet?.membershipCount ?? null,
  })
  const optedInByChannel: Partial<Record<DisplayMarketingChannel, boolean>> = {}
  for (const consent of consents) {
    if (consent.channel !== "push") {
      optedInByChannel[consent.channel] = consent.optedIn
    }
  }
  const hasAnyConsent = channels.some(
    (channel) => optedInByChannel[channel] !== undefined
  )

  return (
    <section className="surface-card grid gap-4 p-5">
      <SectionHeader eyebrow="Marketing" title="Updates from your venues" />
      <p className="text-sm leading-6 text-muted-foreground">
        Optional. Turning these off won&apos;t affect stamps or rewards.
      </p>

      {notice ? (
        <p className="text-sm leading-6 text-foreground">{notice}</p>
      ) : (
        <CustomerProfileMarketingRows
          channels={channels}
          optedInByChannel={optedInByChannel}
        />
      )}

      {!notice && !hasAnyConsent ? (
        <p className="text-xs leading-5 text-muted-foreground">
          You choose this when you join a venue — change it here any time.
        </p>
      ) : null}
    </section>
  )
}
