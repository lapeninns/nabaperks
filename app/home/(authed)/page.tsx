import { PageTitle } from "@/components/brand"
import { HomeActivitySnippet } from "@/components/customer/home-activity-snippet"
import { HomeBirthdayPrompt } from "@/components/customer/home-birthday-prompt"
import { HomeCardTile } from "@/components/customer/home-card-tile"
import { HomeEmptyState } from "@/components/customer/home-empty-state"
import { HomeRedeemBanner } from "@/components/customer/home-redeem-banner"
import { HomeSummaryStrip } from "@/components/customer/home-summary-strip"
import { getCustomerHomeDashboard } from "@/lib/customer/home"
import { getCurrentCustomer } from "@/lib/customer/identity"

export const metadata = {
  title: "My Nabaperks",
}

export default async function HomeDashboardPage() {
  const { cards, summary, topRedeemable, recentActivity } =
    await getCustomerHomeDashboard()
  // getCurrentCustomer is React.cache'd (already loaded upstream), so this is a
  // free read of the stored DOB.
  const customer = await getCurrentCustomer()
  const needsBirthday = !customer?.dateOfBirth && cards.length > 0

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Your cards"
        description="Every card you've collected. Tap one to see its stamps and rewards."
      />

      {cards.length === 0 ? (
        <HomeEmptyState />
      ) : (
        <>
          <HomeSummaryStrip summary={summary} />
          <HomeRedeemBanner topRedeemable={topRedeemable} />
          {needsBirthday ? <HomeBirthdayPrompt /> : null}
          <div className="grid gap-4">
            {cards.map((card) => (
              <HomeCardTile key={card.membershipId} card={card} />
            ))}
          </div>
          <HomeActivitySnippet items={recentActivity} />
        </>
      )}
    </div>
  )
}
