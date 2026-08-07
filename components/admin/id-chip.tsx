"use client"

import { useEffect, useRef, useState } from "react"
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { cn } from "@/lib/utils"

/**
 * Mono id affordance for the console: the single id renderer for admin
 * (audit actor/target ids, privacy references, Stripe refs). Shows an
 * identifiable head-and-tail of the value, copies the FULL identifier on
 * click, and always exposes it via `title`.
 *
 * Three deliberate details:
 * - `first8…last4`, not the first 8 characters. Eight hex characters of a UUID
 *   are not safe to quote in a GDPR or audit record; the tail disambiguates.
 * - A leading copy glyph instead of a dotted underline. The underline promised
 *   navigation and delivered a clipboard write.
 * - Copy feedback swaps the glyph (copy → tick) rather than inserting a
 *   "copied" word, so the control cannot change width and nudge its neighbours
 *   inside a table row.
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
      aria-label={`Copy identifier ${prefix ? `${prefix} ` : ""}${value}`}
      className={cn(
        // Coarse pointers get the 44px tap floor (the Button xs/sm pattern);
        // fine pointers keep the compact inline-chip line height. .mono-meta,
        // not a third `font-mono text-xs` register.
        "focus-ring mono-meta inline-flex max-w-full items-center gap-1.5 rounded-sm text-muted-foreground normal-case hover:text-foreground [@media(pointer:coarse)]:min-h-11",
        className
      )}
    >
      <Icon
        icon={copied ? Tick02Icon : Copy01Icon}
        size={14}
        strokeWidth={2.25}
        className="shrink-0"
      />
      <span className="truncate">
        {prefix ? `${prefix}:` : ""}
        {shortenIdentifier(value)}
      </span>
      <span aria-live="polite" className="sr-only">
        {copied ? "Identifier copied to clipboard" : ""}
      </span>
    </button>
  )
}

/** `3fa9c1b2…7d0e` — head and tail, so two ids cannot read as the same one. */
export function shortenIdentifier(value: string) {
  if (value.length <= 14) return value
  return `${value.slice(0, 8)}…${value.slice(-4)}`
}
