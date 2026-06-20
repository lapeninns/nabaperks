import Link from "next/link"

import { PageTitle } from "@/components/brand"
import { RewardTicket, StatusBanner } from "@/components/loyalty"
import { MerchantRewardCollectionForm } from "@/components/merchant/reward-collection-form"
import { Button } from "@/components/ui/button"

/**
 * Mirror of `/app/rewards/scan/[rewardId]` in its ready-to-collect state. Reuses
 * the real `RewardTicket` + `StatusBanner` (plain) and `MerchantRewardCollectionForm`
 * (client) with a mock scan token, inside the production "ScanShell" layout.
 */
export function MerchantRewardScanScreen() {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <PageTitle
        eyebrow="Reward collection"
        title="Check and collect reward"
        description="Confirm the customer is at the counter before marking the reward collected."
      />
      <section className="grid gap-4">
        <RewardTicket
          state="ready"
          name="Free filter coffee"
          description="Any filter coffee on the house. Valid from the next UK business day."
        />

        <div className="grid gap-2 rounded-xl border-2 border-ink bg-card p-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="font-bold text-muted-foreground">Customer</span>
            <span className="text-right font-bold">S. R.</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="font-bold text-muted-foreground">Card</span>
            <span className="text-right font-mono text-xs font-bold uppercase">
              membersh
            </span>
          </div>
        </div>

        <StatusBanner title="Ready to collect" tone="success">
          Check the reward against the order. Mark it collected when you have
          served it.
        </StatusBanner>
        <MerchantRewardCollectionForm scanToken="preview-scan-token" />

        <Button asChild variant="secondary">
          <Link href="/app/activity">Back to activity</Link>
        </Button>
      </section>
    </div>
  )
}
