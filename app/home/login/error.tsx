"use client"

import { CustomerErrorState } from "@/components/customer/customer-error-state"
import { CustomerShell } from "@/components/layout"
import { recoverFromBoundaryError } from "@/lib/navigation/stale-server-action"

export default function CustomerLoginError({
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
        description="We couldn't open sign-in just now. Your stamps are safe. Try again in a moment."
        reset={() => recoverFromBoundaryError(error, reset)}
        secondaryAction={{ label: "Scan a venue QR", href: "/scan" }}
      />
    </CustomerShell>
  )
}
