"use client"

import { Component, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState } from "@/components/brand"
import { Button } from "@/components/ui/button"

/**
 * Per-stream error boundary for dashboard Suspense children: when one stream
 * fails (e.g. activity), the rest of the page — KPIs, nav, header — stays up
 * instead of the whole segment swapping to app/app/error.tsx. The fallback's
 * "Try again" refreshes the route (a client remount alone cannot refetch a
 * rejected RSC payload) and clears the boundary so the fresh payload renders.
 */
export class StreamErrorBoundary extends Component<
  {
    children: ReactNode
    /** Short noun for the failed stream, e.g. "recent activity". */
    label: string
  },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <StreamErrorCard
          label={this.props.label}
          onRetry={() => this.setState({ hasError: false })}
        />
      )
    }

    return this.props.children
  }
}

function StreamErrorCard({
  label,
  onRetry,
}: {
  label: string
  onRetry: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <section className="surface-card grid place-items-center px-6 py-10">
      <EmptyState
        icon={AlertDiamondIcon}
        title={`Could not load ${label}`}
        description="The rest of your dashboard is unaffected. Try again — your card, members, and rewards are safe on the server."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                router.refresh()
                onRetry()
              })
            }
          >
            {pending ? "Retrying…" : "Try again"}
          </Button>
        }
      />
    </section>
  )
}
