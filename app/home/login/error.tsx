"use client"

import { CustomerErrorState } from "@/components/customer/customer-error-state"
import { CustomerShell } from "@/components/layout"

export default function CustomerLoginError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <CustomerShell>
      <CustomerErrorState
        title="Sign in unavailable"
        description="Signing in could not be loaded safely. Your cards and stamps are safe — try again in a moment."
        reset={reset}
        secondaryAction={{ label: "Scan a venue QR", href: "/scan" }}
      />
    </CustomerShell>
  )
}
