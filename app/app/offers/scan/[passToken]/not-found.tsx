import Link from "next/link"
import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState } from "@/components/brand"
import { Button } from "@/components/ui/button"

// Pass-scan-scoped 404: written for the discount-pass flow so it does not
// inherit the generic /app copy, and so it never suggests the member's pass
// itself has gone — only this one short-lived code has.
export default function MerchantOfferPassScanNotFound() {
  return (
    <section className="mx-auto grid max-w-xl gap-6">
      <EmptyState
        headingLevel={1}
        icon={AlertDiamondIcon}
        title="Discount code not found"
        description="That code has gone cold — codes last a few minutes and then refresh. Ask the member to open their discount pass again and show you a fresh code."
        actions={
          <Button asChild>
            <Link href="/app/activity">Back to activity</Link>
          </Button>
        }
      />
    </section>
  )
}
