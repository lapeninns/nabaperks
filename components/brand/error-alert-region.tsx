"use client"

import { useEffect, useRef, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * ErrorAlertRegion — the announcement + focus half of an error boundary.
 *
 * A boundary swaps the page out from under the user without moving focus, so
 * assistive-technology users were left on a node that no longer exists and got
 * no signal that anything had failed. This wraps a boundary's visual content,
 * announces it via `role="alert"`, and takes focus once on mount so the next
 * Tab continues from the error rather than the top of the document.
 *
 * Client component: focus is a browser effect.
 */
export function ErrorAlertRegion({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className={cn("focus-target w-full rounded-lg", className)}
    >
      {children}
    </div>
  )
}
