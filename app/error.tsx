"use client"

import { CustomerErrorState } from "@/components/customer/customer-error-state"

/**
 * Root error boundary — catches render errors on the public marketing and
 * legal routes (the segments without their own boundary), so a thrown error
 * reads as a designed Wet Ink state instead of Next's unbranded default.
 * House pattern: the customer lane's CustomerErrorState with `reset()` retry.
 */
export default function RootError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-6 py-10">
      <div className="w-full max-w-sm">
        <CustomerErrorState
          title="Something went wrong"
          description="This page hit a snag on our side. Nothing you saved has been lost."
          reset={reset}
          secondaryAction={{ label: "Nabaperks home", href: "/" }}
        />
      </div>
    </main>
  )
}
