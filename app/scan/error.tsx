"use client"

import { CustomerErrorState } from "@/components/customer/customer-error-state"
import { CustomerShell } from "@/components/layout"

export default function CustomerScanError({
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
        reset={reset}
        secondaryAction={{ label: "Open my cards", href: "/home" }}
      />
    </CustomerShell>
  )
}
