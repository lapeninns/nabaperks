"use client"

import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState } from "@/components/brand"
import { Button } from "@/components/ui/button"

/**
 * Segment boundary for render/read failures. Server actions return structured
 * errors inline (lib/admin/action-state), so this copy stays neutral about
 * what failed; the digest gives the operator a log-correlation handle —
 * safe and useful in an internal console.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto grid min-h-[50vh] w-full max-w-2xl place-items-center px-6 py-10">
      <EmptyState
        icon={AlertDiamondIcon}
        title="This admin view hit an error"
        description={
          <>
            The view could not load safely. Retry, and if it keeps happening
            check the server logs.
            {error.digest ? (
              <span className="mono-id mt-2 block">
                Log reference: {error.digest}
              </span>
            ) : null}
          </>
        }
        actions={
          <Button type="button" onClick={reset}>
            Retry
          </Button>
        }
      />
    </main>
  )
}
