"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Mono id affordance for the console: shows the familiar 8-char prefix, but
 * the full identifier is one click away (clipboard) and always inspectable
 * via `title`. Used wherever the admin console truncates a UUID — audit
 * actor/target ids, privacy record references — so an operator can correlate
 * a row with the database without retyping from a screenshot.
 */
export function AdminIdChip({
  value,
  prefix,
  className,
}: {
  readonly value: string
  /** Optional context label rendered before the id, e.g. a table name. */
  readonly prefix?: string
  readonly className?: string
}) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard unavailable (permissions/insecure context): the title
      // attribute still exposes the full id for manual selection.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={value}
      className={cn(
        // Coarse pointers get the 44px tap floor (the Button xs/sm pattern);
        // fine pointers keep the compact inline-chip line height.
        "focus-ring inline-flex max-w-full items-center gap-1 rounded-sm font-mono text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground [@media(pointer:coarse)]:min-h-11",
        className
      )}
    >
      <span className="truncate">
        {prefix ? `${prefix}:` : ""}
        {value.slice(0, 8)}
      </span>
      {copied ? <span aria-hidden="true">copied</span> : null}
      <span aria-live="polite" className="sr-only">
        {copied ? "Identifier copied to clipboard" : ""}
      </span>
    </button>
  )
}
