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
  // No ad-hoc padding wrapper. The other three customer boundaries hand
  // CustomerErrorState straight to CustomerShell, which already sets the top
  // offset; this one sat inside the authed shell's `pt-6` main AND added its
  // own `py-8`, so the retry button landed 32px lower here than on
  // /card, /scan or /home/login. One container strategy, four boundaries
  // (CUS 02#68).
  return (
    <CustomerErrorState
      title="That didn't load"
      description="Something interrupted this page. Try again. Your cards and stamps are safe on the server."
      reset={reset}
    />
  )
}
