import Link from "next/link"
import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState } from "@/components/brand"
import { Button } from "@/components/ui/button"

// Scan-scoped 404: this copy was written for the reward-collection flow and
// lives here so poster/other /app 404s no longer inherit reward-scan guidance
// (the segment-wide app/app/not-found.tsx is generic).
export default function MerchantRewardScanNotFound() {
  return (
    <section className="mx-auto grid max-w-xl gap-6">
      <EmptyState
        headingLevel={1}
        icon={AlertDiamondIcon}
        title="Reward not found"
        description="That scan code has gone cold — it may have already been collected or refreshed. Ask the customer to scan the venue QR again, or head back to activity."
        actions={
          <Button asChild>
            <Link href="/app/activity">Back to activity</Link>
          </Button>
        }
      />
    </section>
  )
}
