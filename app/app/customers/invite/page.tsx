import { redirect } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { InviteCustomersForm } from "@/components/merchant/invite-customers-form"
import { getCurrentMerchant } from "@/lib/auth/session"
import { isLoyaltyInvitesEnabled } from "@/lib/loyalty-invites/access"
import { getActiveLoyaltyInviteCampaign } from "@/lib/merchant/loyalty-invites"

export const dynamic = "force-dynamic"

export default async function InviteCustomersPage() {
  const merchant = await getCurrentMerchant()
  if (!merchant) {
    redirect("/app/onboarding")
  }
  if (!isLoyaltyInvitesEnabled(Boolean(merchant.loyalty_invites_enabled))) {
    redirect("/app/customers")
  }

  const activeCampaign = await getActiveLoyaltyInviteCampaign(merchant.id)

  return (
    <div className="grid max-w-2xl min-w-0 gap-6">
      <PageTitle
        eyebrow="Members"
        title="Invite customers"
        description="Email your customers a one-off invitation worth two welcome stamps. Only import lists you have a lawful basis to email — never bought, scraped or third-party addresses."
      />
      <InviteCustomersForm activeCampaign={activeCampaign} />
    </div>
  )
}
