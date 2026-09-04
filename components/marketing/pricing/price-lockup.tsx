import { cn } from "@/lib/utils"

const AMOUNT_SIZE = {
  /** Editorial numeral on the two-card pricing layout. */
  display: "text-5xl leading-none tracking-tighter sm:text-6xl lg:text-7xl",
  /** Dominant numeral for a cadence panel. */
  hero: "text-5xl leading-none sm:text-6xl",
  /** Secondary schedules and merchant activation. */
  lead: "text-2xl leading-none sm:text-3xl",
  inline: "",
} as const

const TONE_AMOUNT = {
  paper: "text-foreground",
  ink: "text-paper",
} as const

const TONE_CADENCE = {
  paper: "text-muted-foreground",
  ink: "text-paper/70",
} as const

/**
 * PriceLockup — the single price idiom for the whole product.
 *
 * `hero` and `lead` split the amount from its cadence so the numeral can
 * dominate. `inline` deliberately does NOT split: it emits one contiguous
 * text node — `` `£${amount} ${cadence}` `` — because the merchant billing
 * specs assert exact single text nodes and a split lockup would break them.
 *
 * `amount` is the bare numeral from facts (`PRODUCT.priceAmount`), never a
 * pre-composed string — the £ is owned here so the cadence pairing stays
 * consistent across every surface.
 */
export function PriceLockup({
  amount,
  cadence,
  note,
  size = "lead",
  tone = "paper",
  className,
  ...props
}: {
  amount: string
  cadence: string
  /** Optional second cadence line stacked under `cadence` (display lockups). */
  note?: string
  size?: keyof typeof AMOUNT_SIZE
  tone?: keyof typeof TONE_AMOUNT
  className?: string
} & React.ComponentProps<"p">) {
  if (size === "inline") {
    return (
      <span className={cn("numeric-tabular", className)} {...props}>
        {`£${amount} ${cadence}`}
      </span>
    )
  }

  return (
    <p
      className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}
      {...props}
    >
      {/* No text node between these two spans on purpose: it keeps this <p>'s
          textContent distinct from the `inline` variant's exact-text locator,
          which several merchant billing specs rely on to stay single-match. */}
      <span
        className={cn(
          "numeric-tabular font-extrabold",
          TONE_AMOUNT[tone],
          AMOUNT_SIZE[size]
        )}
      >
        £{amount}
      </span>
      <span
        className={cn(
          "flex min-w-0 flex-col text-sm leading-tight font-medium",
          TONE_CADENCE[tone]
        )}
      >
        <span className="mono-meta">{cadence}</span>
        {note ? <span>{note}</span> : null}
      </span>
    </p>
  )
}
