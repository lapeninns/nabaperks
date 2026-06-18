"use client"

import { CustomerErrorState } from "@/components/customer/customer-error-state"
import { CustomerShell } from "@/components/layout"

export default function CustomerRewardError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <CustomerShell className="grid content-center">
      <CustomerErrorState
        title="Reward unavailable"
        description="This reward could not be loaded safely. Return to the customer card or ask a team member for help."
        reset={reset}
        secondaryAction={{ label: "Open my cards", href: "/home" }}
      />
    </CustomerShell>
  )
}
