"use client"

import { CustomerErrorState } from "@/components/customer/customer-error-state"
import { CustomerShell } from "@/components/layout"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { recoverFromBoundaryError } from "@/lib/navigation/stale-server-action"

export default function CustomerJoinError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <CustomerShell className="grid content-center">
      <CustomerErrorState
        title="We couldn't open this step"
        description="Your stamps are safe. Try again, or ask a member of staff for help."
        reset={() => recoverFromBoundaryError(error, reset)}
        secondaryAction={{ label: OPEN_MY_CARDS_LABEL, href: "/home" }}
      />
    </CustomerShell>
  )
}
