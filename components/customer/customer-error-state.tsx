"use client"

import { useEffect, useRef, useTransition, type ReactNode } from "react"
import Link from "next/link"

import { Logo } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { retryButtonState } from "@/lib/customer/experience/retry-button"

/**
 * Shared Wet Ink surface for customer error boundaries. Pairs the brand venue
 * mark with the error banner and the `reset()` retry that Next.js hands every
 * error boundary, so a thrown error reads as a designed state rather than a bare
 * fallback. Shell-less: each boundary supplies its own shell (or sits inside the
 * one already rendered by a parent layout).
 */
export function CustomerErrorState({
  title,
  description,
  reset,
  secondaryAction,
}: {
  title: string
  description: ReactNode
  /** The retry handler Next.js passes to the boundary. Re-renders the segment. */
  reset?: () => void
  secondaryAction?: { label: string; href: string }
}) {
  const [isPending, startTransition] = useTransition()
  const retry = retryButtonState(isPending)
  const headingRef = useRef<HTMLElement>(null)

  // An error boundary replaces the page under the user without moving focus,
  // so a screen-reader or keyboard user was left with focus on a node that no
  // longer exists and no announcement that anything had failed. Move focus to
  // the error surface once, on mount; `role="alert"` announces it for users
  // who are not keyboard-driven.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section
      ref={headingRef}
      tabIndex={-1}
      role="alert"
      className="focus-target grid justify-items-center gap-5 rounded-lg text-center"
    >
      {/* The product wordmark, not a VenueMark. This surface fronts card, scan
          and login failures, and a 56px venue roundel captioned "Nabaperks"
          read as though Nabaperks were the venue whose card had just failed —
          on /card/[membershipId] the member's venue is someone else entirely
          (CUS 02#68). An error boundary is handed only `error` and `reset`, so
          the real venue name is not available to it without a fetch on a path
          that has already failed. Naming no venue is honest; naming the wrong
          one is not. */}
      <Logo href="/home" linked={false} />
      <StatusBanner title={title} tone="error" className="w-full text-center">
        {description}
      </StatusBanner>
      {reset || secondaryAction ? (
        <div className="grid w-full gap-2">
          {reset ? (
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={retry.disabled}
              aria-busy={isPending}
              onClick={() => startTransition(() => reset())}
            >
              {retry.label}
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button asChild size="lg" variant="secondary" className="w-full">
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
