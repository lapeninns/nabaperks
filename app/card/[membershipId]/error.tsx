"use client"

import { CustomerErrorState } from "@/components/customer/customer-error-state"
import { CustomerShell } from "@/components/layout"

export default function CustomerCardError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <CustomerShell className="grid content-center">
      <CustomerErrorState
        title="Card unavailable"
        description="This card could not be loaded safely. Ask a team member for the current loyalty QR and try again."
        reset={reset}
        secondaryAction={{ label: "Open my cards", href: "/home" }}
      />
    </CustomerShell>
  )
}
