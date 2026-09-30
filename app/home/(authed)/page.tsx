import { PageTitle } from "@/components/brand"
import { HomeActivitySnippet } from "@/components/customer/home-activity-snippet"
import { HomeCardTile } from "@/components/customer/home-card-tile"
import { HomeEmptyState } from "@/components/customer/home-empty-state"
import { HomeRedeemBanner } from "@/components/customer/home-redeem-banner"
import { HomeSetupSuggestion } from "@/components/customer/home-setup-suggestion"
import { HomeSummaryStrip } from "@/components/customer/home-summary-strip"
import { customerHasVerifiedPhone } from "@/lib/customer/phone-verification-state"
import { emailPromptReason } from "@/lib/customer/email-auth-mode"
import { emailPromptOpening } from "@/lib/customer/email-prompt-opening"
import { getCustomerHomeDashboard } from "@/lib/customer/home"
import { homeSetupSuggestionCandidates } from "@/lib/customer/home-setup-suggestion"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { customerHasVerifiedEmail } from "@/lib/customer/profile"
import { getPendingEmailVerification } from "@/lib/customer/session"
import { listCustomerOfferPasses } from "@/lib/customer/offer-pass"
import { groupOfferPassesByMembership } from "@/lib/customer/offer-pass-view"

export const metadata = {
  title: "My Nabaperks",
}

/** Shared empty rail, so a card without passes allocates nothing per render. */
const NO_OFFER_PASSES = Object.freeze([])

export default async function HomeDashboardPage() {
  // Discount passes are read beside the dashboard rather than inside it: a pass
  // is its own record against a venue, not a field of the loyalty card, and
  // `HomeCard` deliberately carries no pass data. One indexed read serves every
  // tile, so this is a single extra query, not one per card.
  const [{ cards, summary, topRedeemable, recentActivity }, offerPasses] =
    await Promise.all([getCustomerHomeDashboard(), listCustomerOfferPasses()])
  const passesByMembership = groupOfferPassesByMembership(offerPasses)
  // getCurrentCustomer is React.cache'd (already loaded upstream), so this is a
  // free read of the stored profile.
  const customer = await getCurrentCustomer()
  // At most one optional suggestion, chosen by priority in a pure helper: a
  // reward needing setup owns the slot through its own "Get it ready" action,
  // then mobile number, previous stamps, email and birthday. An empty home
  // gets none, so the scan action is the only thing to do there.
  const candidates =
    customer && cards.length > 0
      ? homeSetupSuggestionCandidates({
          cardCount: cards.length,
          rewardNeedsSetup: (summary.setupRewardCount ?? 0) > 0,
          hasConfirmedPhone: await customerHasVerifiedPhone(customer.id),
          hasConfirmedEmail: customerHasVerifiedEmail(customer),
          hasBirthday: Boolean(customer.dateOfBirth),
        })
      : []
  // Open the email suggestion at the code step only when a code for the saved
  // address is genuinely on its way to this customer; otherwise prefill it.
  const emailOpening =
    candidates.includes("email") && customer
      ? emailPromptOpening(customer, await getPendingEmailVerification())
      : null

  return (
    <div className="grid gap-6">
      {/* No description: a returning guest should reach a ready reward and
          their cards immediately, and the empty home is explained in full by
          HomeEmptyState below rather than twice over. */}
      <PageTitle eyebrow="My Nabaperks" title="Your cards" />

      {cards.length === 0 ? (
        <HomeEmptyState />
      ) : (
        <>
          <HomeSummaryStrip summary={summary} />
          <HomeRedeemBanner topRedeemable={topRedeemable} />
          <div className="grid gap-4">
            {cards.map((card) => (
              <HomeCardTile
                key={card.membershipId}
                card={card}
                offerPasses={
                  passesByMembership.get(card.membershipId) ?? NO_OFFER_PASSES
                }
              />
            ))}
          </div>
          {/* Always mounted, so an engaged email step survives the re-render
              that follows confirming it. It renders one suggestion or none. */}
          <HomeSetupSuggestion
            candidates={candidates}
            emailReason={emailPromptReason()}
            initialEmail={emailOpening?.initialEmail ?? null}
            codePending={emailOpening?.codePending ?? false}
          />
          <HomeActivitySnippet items={recentActivity} />
        </>
      )}
    </div>
  )
}
