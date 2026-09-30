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
        title="Something went wrong"
        description="We couldn't open the scanner. Your stamps are safe. Try again, or scan the venue QR with your phone's camera app."
        reset={() => recoverFromBoundaryError(error, reset)}
        secondaryAction={{ label: OPEN_MY_CARDS_LABEL, href: "/home" }}
      />
    </CustomerShell>
  )
}
