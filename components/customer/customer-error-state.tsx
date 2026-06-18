"use client"

import type { ReactNode } from "react"
import Link from "next/link"

import { VenueMark } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"

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
  return (
    <section className="grid justify-items-center gap-5 text-center">
      <VenueMark size={56} name="Nabaperks" caption="Nabaperks" />
      <StatusBanner title={title} tone="error" className="w-full text-center">
        {description}
      </StatusBanner>
      {reset || secondaryAction ? (
        <div className="grid w-full gap-2">
          {reset ? (
            <Button type="button" size="lg" className="w-full" onClick={reset}>
              Try again
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
