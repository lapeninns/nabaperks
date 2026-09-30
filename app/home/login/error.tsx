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
        title="Sign in unavailable"
        description="Signing in could not be loaded safely. Your cards and stamps are safe — try again in a moment."
        reset={() => recoverFromBoundaryError(error, reset)}
        secondaryAction={{ label: "Scan a venue QR", href: "/scan" }}
      />
    </CustomerShell>
  )
}
