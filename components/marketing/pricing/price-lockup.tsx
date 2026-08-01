import { cn } from "@/lib/utils"

const AMOUNT_SIZE = {
  /** The page's dominant numeral — one per surface. */
  hero: "text-5xl leading-none sm:text-6xl",
  /** Secondary schedules and merchant activation. */
  lead: "text-2xl leading-none sm:text-3xl",
  inline: "",
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
  size = "lead",
  className,
  ...props
}: {
  amount: string
  cadence: string
  size?: keyof typeof AMOUNT_SIZE
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
      className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}
      {...props}
    >
      {/* No text node between these two spans on purpose: it keeps this <p>'s
          textContent distinct from the `inline` variant's exact-text locator,
          which several merchant billing specs rely on to stay single-match. */}
      <span
        className={cn(
          "numeric-tabular font-extrabold text-foreground",
          AMOUNT_SIZE[size]
        )}
      >
        £{amount}
      </span>
      <span className="mono-meta text-muted-foreground">{cadence}</span>
    </p>
  )
}
