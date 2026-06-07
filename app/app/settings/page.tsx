import { redirect } from "next/navigation"

import { PageTitle, SectionHeader } from "@/components/brand"
import { RoiSettingsForm } from "@/components/merchant/roi-settings-form"
import { StaffPinSettingsForm } from "@/components/merchant/staff-pin-settings-form"
import { getCurrentMerchant } from "@/lib/auth/session"
import { getStaffPinSetup } from "@/lib/merchant/staff-pin"

export default async function MerchantSettingsPage() {
  const [merchant, staffPinSetup] = await Promise.all([
    getCurrentMerchant(),
    getStaffPinSetup(),
  ])

  if (!merchant || !staffPinSetup) {
    redirect("/app/onboarding")
  }

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Settings"
        title="Merchant settings"
        description="Manage the staff PIN used at the counter and the estimate values used for pilot dashboard readback."
      />

      <section className="grid gap-4">
        <SectionHeader
          title="Staff PIN"
          description="One shared counter PIN approves customer stamps and reward redemptions for the primary location."
        />
        <StaffPinSettingsForm setup={staffPinSetup} />
      </section>

      <section className="grid gap-4">
        <SectionHeader
          title="ROI estimate settings"
          description="These values power estimated dashboard figures only. Stampiee does not claim guaranteed revenue attribution."
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <RoiSettingsForm
            averageOrderValuePence={merchant.average_order_value_pence}
            estimatedGrossMarginBps={merchant.estimated_gross_margin_bps}
            rewardCostPence={merchant.reward_cost_pence}
          />
          <section className="rounded-3xl border bg-card p-5 shadow-xs">
            <h3 className="text-lg font-extrabold">Estimate formula</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Estimated repeat revenue = repeat customers x average order value.
              Gross margin and reward cost are stored now for pilot readback and
              later profitability reporting.
            </p>
          </section>
        </div>
      </section>
    </div>
  )
}
