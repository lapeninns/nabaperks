import Link from "next/link"
import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState } from "@/components/brand"
import { Button } from "@/components/ui/button"

// Rendered inside MerchantAppShell via app/app/layout, so notFound() from any
// /app route resolves to a merchant-scoped 404 (merchant voice, in-shell)
// rather than ejecting to the root customer-wallet app/not-found.tsx.
// Flow-specific copy lives in scoped boundaries (rewards/scan/[scanToken],
// qr/poster/[template]); this segment-wide fallback stays generic.
export default function MerchantAppNotFound() {
  return (
    <section className="mx-auto grid max-w-xl gap-6 px-6 py-10 sm:px-0 sm:py-0">
      <EmptyState
        headingLevel={1}
        icon={AlertDiamondIcon}
        title="Page not found"
        description="That page does not exist or has moved. Your card, members, and rewards are safe — head back to the dashboard."
        actions={
          <Button asChild>
            <Link href="/app">Back to dashboard</Link>
          </Button>
        }
      />
    </section>
  )
}
