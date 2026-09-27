import { PageTitle } from "@/components/brand"
import { HomeActivitySnippet } from "@/components/customer/home-activity-snippet"
import { HomeBirthdayPrompt } from "@/components/customer/home-birthday-prompt"
import { HomeCardTile } from "@/components/customer/home-card-tile"
import { HomeEmailPrompt } from "@/components/customer/home-email-prompt"
import { HomeEmptyState } from "@/components/customer/home-empty-state"
import { HomeRedeemBanner } from "@/components/customer/home-redeem-banner"
import { HomeSummaryStrip } from "@/components/customer/home-summary-strip"
import { emailPromptReason } from "@/lib/customer/email-auth-mode"
import { getCustomerHomeDashboard } from "@/lib/customer/home"
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
  // free read of the stored DOB.
  const customer = await getCurrentCustomer()
  const needsBirthday = !customer?.dateOfBirth && cards.length > 0
  const needsEmail =
    customer !== null && cards.length > 0 && !customerHasVerifiedEmail(customer)
  // Open the prompt at the code step only when a code for the saved address is
  // genuinely on its way to this customer; otherwise prefill the address.
  const pendingEmail = needsEmail ? await getPendingEmailVerification() : null
  const codePending = Boolean(
    pendingEmail &&
    customer &&
    pendingEmail.customerId === customer.id &&
    pendingEmail.email === customer.email?.trim().toLowerCase()
  )
  const birthdayPrompt = needsBirthday ? <HomeBirthdayPrompt /> : null

  return (
    <div className="grid gap-6">
      {/* No description: a returning wallet should reach its summary, ready
          reward and cards immediately, and the empty wallet is explained in full
          by HomeEmptyState below rather than twice over. */}
      <PageTitle eyebrow="My Nabaperks" title="Your cards" />

      {cards.length === 0 ? (
        <HomeEmptyState />
      ) : (
        <>
          <HomeSummaryStrip summary={summary} />
          <HomeRedeemBanner topRedeemable={topRedeemable} />
          {/* At most one prompt: email first; the birthday prompt shows only
              when no email is needed or the email prompt was dismissed. The
              email prompt is always mounted here (reason null when not asking)
              so confirming an email, which re-renders this page without the
              ask, still shows the confirmation. */}
          <HomeEmailPrompt
            reason={needsEmail ? emailPromptReason() : null}
            initialEmail={needsEmail ? customer?.email?.trim() || null : null}
            codePending={codePending}
            fallback={birthdayPrompt}
          />
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
          <HomeActivitySnippet items={recentActivity} />
        </>
      )}
    </div>
  )
}
