import Link from "next/link"
import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState } from "@/components/brand"
import { Button } from "@/components/ui/button"

// Rendered inside MerchantAppShell via app/app/layout, so notFound() from any
// /app route resolves to a merchant-scoped 404 (operator voice, in-shell)
// rather than ejecting to the root customer-wallet app/not-found.tsx.
export default function MerchantAppNotFound() {
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
