"use client"

import { CustomerErrorState } from "@/components/customer/customer-error-state"
import { CustomerShell } from "@/components/layout"

export default function CustomerJoinError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <CustomerShell className="grid content-center">
      <CustomerErrorState
        title="Join unavailable"
        description="This step could not be loaded safely. Your stamps are safe — try again, or ask a team member for help."
        reset={reset}
        secondaryAction={{ label: "Open my cards", href: "/home" }}
      />
    </CustomerShell>
  )
}
