"use client"

import { CustomerErrorState } from "@/components/customer/customer-error-state"
import { CustomerShell } from "@/components/layout"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { recoverFromBoundaryError } from "@/lib/navigation/stale-server-action"

export default function CustomerQrError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <CustomerShell className="grid content-center">
      <CustomerErrorState
        title="We couldn't load this card"
        description="Check your signal or Wi-Fi, then try again. Your stamps are safe."
        reset={() => recoverFromBoundaryError(error, reset)}
        secondaryAction={{ label: OPEN_MY_CARDS_LABEL, href: "/home" }}
      />
    </CustomerShell>
  )
}
