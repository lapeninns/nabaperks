"use client"

import { CustomerErrorState } from "@/components/customer/customer-error-state"
import { CustomerShell } from "@/components/layout"

export default function CustomerQrError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <CustomerShell className="grid content-center">
      <CustomerErrorState
        title="QR unavailable"
        description="This QR could not be opened safely. Try again, or ask a team member for the current loyalty QR."
        reset={reset}
        secondaryAction={{ label: "Open my cards", href: "/home" }}
      />
    </CustomerShell>
  )
}
