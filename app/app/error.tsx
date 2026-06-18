"use client"

import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState } from "@/components/brand"
import { Button } from "@/components/ui/button"

// Sits inside MerchantAppShell, so the header and nav survive while one section
// recovers. Mirrors the admin console's error boundary (app/admin/error.tsx).
export default function MerchantError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-auto grid min-h-[50vh] w-full max-w-2xl place-items-center px-6 py-10">
      <EmptyState
        icon={AlertDiamondIcon}
        title="That didn't load"
        description="Something interrupted your workspace. Try again — your card, customers, and rewards are safe on the server."
        actions={
          <Button type="button" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  )
}
