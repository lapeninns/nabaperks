"use client"

import Link from "next/link"
import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState, ErrorAlertRegion } from "@/components/brand"
import { Button } from "@/components/ui/button"

// Sits inside MerchantAppShell, so the header and nav survive while one section
// recovers. Mirrors the admin console's error boundary (app/admin/error.tsx).
export default function MerchantError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    // `py-16` rather than `min-h-[50vh]`: an arbitrary viewport unit inside an
    // already-padded shell overshoots on a phone and undershoots on a desktop
    // (03#67).
    <div className="mx-auto grid w-full max-w-2xl place-items-center px-6 py-16">
      <ErrorAlertRegion>
        <EmptyState
          headingLevel={1}
          icon={AlertDiamondIcon}
          title="That didn't load"
          description="Something interrupted your workspace. Try again. Your card, members, and rewards are safe on the server."
          actions={
            <>
              <Button type="button" onClick={reset}>
                Try again
              </Button>
              {/* A second failure of reset() otherwise leaves the browser back
                  button as the only way out (03#67). */}
              <Button asChild variant="secondary">
                <Link href="/app">Back to dashboard</Link>
              </Button>
            </>
          }
        />
        {/* Quotable reference so support can find the request that failed. */}
        {error.digest ? (
          <p className="mono-id mt-4 text-center text-muted-foreground">
            Reference: {error.digest}
          </p>
        ) : null}
      </ErrorAlertRegion>
    </div>
  )
}
