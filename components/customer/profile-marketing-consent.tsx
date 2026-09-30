import { SectionHeader } from "@/components/brand"
import { CustomerProfileMarketingRows } from "@/components/customer/profile-marketing-consent-rows"
import {
  getMarketingConsentEligibility,
  type MarketingConsentEligibility,
} from "@/lib/customer/consent"
import {
  marketingConsentOffer,
  type DisplayMarketingChannel,
} from "@/lib/customer/experience/marketing-consent-row"

type MarketingConsent = {
  channel: "email" | "sms" | "whatsapp" | "push"
  optedIn: boolean
}

/**
 * Offers from venues, the optional part of "Messages from venues" on the
 * profile. One toggle per channel
 * applies across every venue. Only the channels the wallet can choose are
 * offered: text and WhatsApp need a verified phone, email needs a verified
 * email, and a wallet with no venue yet is told it chooses updates when it
 * joins (the server refuses the same changes). A channel already opted in
 * without its verified contact stays offered so it can be turned off, with a
 * note that it cannot be turned back on until the contact is verified.
 */
export async function CustomerProfileMarketing({
  consents,
  hasPhone = true,
  eligibility,
  embedded = false,
}: {
  consents: readonly MarketingConsent[]
  /**
   * False for a wallet with no verified phone (for example one started with
   * an email): text and WhatsApp need a phone, so they are not offered.
   */
  hasPhone?: boolean
  /** Loaded for the signed-in wallet when not given. */
  eligibility?: MarketingConsentEligibility | null
  /**
   * Inside the "Messages from venues" block: no card of its own and a
   * sub-heading instead of a section header.
   */
  embedded?: boolean
}) {
  const wallet =
    eligibility === undefined
      ? await getMarketingConsentEligibility()
      : eligibility
  const optedInByChannel: Partial<Record<DisplayMarketingChannel, boolean>> = {}
  for (const consent of consents) {
    if (consent.channel !== "push") {
      optedInByChannel[consent.channel] = consent.optedIn
    }
  }
  const { channels, notice, notices } = marketingConsentOffer({
    hasVerifiedPhone: hasPhone && (wallet?.hasVerifiedPhone ?? true),
    hasVerifiedEmail: wallet?.hasVerifiedEmail ?? null,
    membershipCount: wallet?.membershipCount ?? null,
    optedInByChannel,
  })
  const hasAnyConsent = channels.some(
    (channel) => optedInByChannel[channel] !== undefined
  )

  const content = (
    <>
      {embedded ? (
        <h3 className="eyebrow">Offers</h3>
      ) : (
        <SectionHeader eyebrow="Optional" title="Messages from venues" />
      )}
      <p className="text-sm leading-6 text-muted-foreground">
        Optional. Turning these off won&apos;t change your stamps or rewards.
      </p>

      {notice ? (
        <p className="text-sm leading-6 text-foreground">{notice}</p>
      ) : (
        <CustomerProfileMarketingRows
          channels={channels}
          optedInByChannel={optedInByChannel}
        />
      )}

      {notices.map((withdrawOnlyNotice) => (
        <p
          key={withdrawOnlyNotice}
          className="text-xs leading-5 text-muted-foreground"
        >
          {withdrawOnlyNotice}
        </p>
      ))}

      {!notice && !hasAnyConsent ? (
        <p className="text-xs leading-5 text-muted-foreground">
          You can change these any time.
        </p>
      ) : null}
    </>
  )

  return embedded ? (
    <div className="grid gap-4" data-marketing-offers>
      {content}
    </div>
  ) : (
    <section className="surface-card grid gap-4 p-5" data-marketing-offers>
      {content}
    </section>
  )
}
