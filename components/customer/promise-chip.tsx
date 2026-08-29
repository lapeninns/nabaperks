import type { ComponentPropsWithoutRef, ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * PromiseChip — the surface for "something is waiting for you on this card".
 *
 * Four different promises (a revealed reward, a discount pass, a gift, a
 * referral bonus bank) each hand-rolled the SAME block —
 * `grid gap-1.5 rounded-lg border-2 border-ink bg-seal/15 p-3` — across six
 * components, so at a glance they were indistinguishable: same sun wash, same
 * border, same rhythm, four different meanings.
 *
 * The wash now follows DESIGN.md's spot inks, so the kind is legible before the
 * words are read: leaf for a reward earned, cobalt for an offer/pass (the
 * info/joins ink), sun for a gift, and the plain secondary ground for the bonus
 * bank, which is a running total rather than a thing to collect.
 */
const PROMISE_TONE = {
  reward: "bg-reward/12",
  pass: "bg-cobalt/10",
  gift: "bg-seal/15",
  bonus: "bg-secondary",
} as const

export type PromiseChipKind = keyof typeof PROMISE_TONE

export function PromiseChip({
  kind,
  className,
  children,
  ...rest
}: {
  readonly kind: PromiseChipKind
  readonly className?: string
  readonly children: ReactNode
} & Omit<ComponentPropsWithoutRef<"div">, "children" | "className">) {
  return (
    <div
      data-promise={kind}
      {...rest}
      className={cn(
        "grid gap-1.5 rounded-lg border-2 border-ink p-3",
        PROMISE_TONE[kind],
        className
      )}
    >
      {children}
    </div>
  )
}
