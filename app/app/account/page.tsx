import { Suspense } from "react"

import { PageTitle } from "@/components/brand"
import { AccountTabBar } from "@/components/merchant/account/account-tab-bar"
import { resolveAccountTab } from "@/components/merchant/account/account-tabs"
import { BillingPanel } from "@/components/merchant/account/billing-panel"
import { ProfilePanel } from "@/components/merchant/account/profile-panel"
import {
  AccountBillingPanelSkeleton,
  AccountProfilePanelSkeleton,
} from "@/components/merchant/loading-skeletons"

export const dynamic = "force-dynamic"

// One stable "Account" frame; only the subtitle changes per tab, so switching
// tabs no longer swaps the whole hero. Pricing lives once, on the billing
// receipt — not here.
const TAB_SUBTITLE = {
  profile: "Your business and venue details. Changes save as you go.",
  billing: "Your plan and payments, handled securely by Stripe.",
} as const

type AccountPageProps = {
  searchParams: Promise<{
    tab?: string
    checkout?: string
    portal?: string
  }>
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams
  const tab = resolveAccountTab(params.tab)

  return (
    <div className="grid gap-6">
      <PageTitle title="Account" description={TAB_SUBTITLE[tab]} />

      <AccountTabBar activeTab={tab} />

      {tab === "billing" ? (
        <Suspense key="billing" fallback={<AccountBillingPanelSkeleton />}>
          <BillingPanel
            params={{ checkout: params.checkout, portal: params.portal }}
          />
        </Suspense>
      ) : (
        <Suspense key="profile" fallback={<AccountProfilePanelSkeleton />}>
          <ProfilePanel />
        </Suspense>
      )}
    </div>
  )
}
