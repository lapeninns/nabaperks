import { PageTitle } from "@/components/brand"
import { AccountTabBar } from "@/components/merchant/account/account-tab-bar"
import { resolveAccountTab } from "@/components/merchant/account/account-tabs"
import { BillingPanel } from "@/components/merchant/account/billing-panel"
import { ProfilePanel } from "@/components/merchant/account/profile-panel"

export const dynamic = "force-dynamic"

const TAB_HEADINGS = {
  profile: {
    title: "Your business",
    description:
      "Keep your business and venue details up to date. Changes save straight away.",
  },
  billing: {
    title: "Growth Plan",
    description: "First 30 days free, then GBP 29/month for each location.",
  },
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
  const heading = TAB_HEADINGS[tab]

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Account"
        title={heading.title}
        description={heading.description}
      />

      <AccountTabBar activeTab={tab} />

      {tab === "billing" ? (
        <BillingPanel
          params={{ checkout: params.checkout, portal: params.portal }}
        />
      ) : (
        <ProfilePanel />
      )}
    </div>
  )
}
