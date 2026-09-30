"use client"

import { CustomerErrorState } from "@/components/customer/customer-error-state"
import { CustomerShell } from "@/components/layout"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { recoverFromBoundaryError } from "@/lib/navigation/stale-server-action"

export default function CustomerScanError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <CustomerShell className="grid content-center">
      <CustomerErrorState
        title="Scanner unavailable"
        description="The scanner could not be opened safely. Try again, or point your phone's camera at the printed venue QR."
        reset={() => recoverFromBoundaryError(error, reset)}
        secondaryAction={{ label: OPEN_MY_CARDS_LABEL, href: "/home" }}
      />
    </CustomerShell>
  )
}
