"use client"

import { EmptyState } from "@/components/brand"
import { Button } from "@/components/ui/button"

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto grid min-h-[50vh] w-full max-w-2xl place-items-center px-6 py-10">
      <EmptyState
        title="Admin readback unavailable"
        description="A support data source could not be loaded safely. Retry the service-role readback or review server logs without exposing backend details in the console."
        actions={
          <Button type="button" onClick={reset}>
            Retry readback
          </Button>
        }
      />
    </main>
  )
}
