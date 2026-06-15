import { redirect } from "next/navigation"

import { PageTitle, SectionHeader } from "@/components/brand"
import { RoiSettingsForm } from "@/components/merchant/roi-settings-form"
import { getCurrentMerchant } from "@/lib/auth/session"

export default async function MerchantSettingsPage() {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Settings"
        title="Your settings"
        description="Set the figures we use to estimate repeat revenue on your dashboard."
      />

      <section className="grid gap-4">
        <SectionHeader
          title="Revenue estimate"
          description="These figures only shape the estimate shown on your dashboard. They are not a promise of revenue."
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <RoiSettingsForm
            averageOrderValuePence={merchant.average_order_value_pence}
            estimatedGrossMarginBps={merchant.estimated_gross_margin_bps}
            rewardCostPence={merchant.reward_cost_pence}
          />
          <section className="surface-card p-5 shadow-xs">
            <h3 className="text-lg font-extrabold">How the estimate works</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              We estimate repeat revenue as repeat customers multiplied by your
              average order value. Gross margin and reward cost are saved for
              fuller reporting later on.
            </p>
          </section>
        </div>
      </section>
    </div>
  )
}
