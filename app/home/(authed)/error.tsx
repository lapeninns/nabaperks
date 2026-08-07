"use client"

import { CustomerErrorState } from "@/components/customer/customer-error-state"

// Sits inside the authed CustomerAppShell, so the header and tab bar survive and
// the customer can navigate away while one section recovers.
export default function HomeError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="py-8">
      <CustomerErrorState
        title="That didn't load"
        description="Something interrupted this page. Try again. Your cards and stamps are safe on the server."
        reset={reset}
      />
    </div>
  )
}
