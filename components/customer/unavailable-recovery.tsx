import Link from "next/link"

import { Button } from "@/components/ui/button"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { cn } from "@/lib/utils"

/**
 * Shared recovery actions for customer unavailable states (`/q`, `/m`, the
 * join wizard): one primary re-entry into the journey and the other as a
 * quiet secondary, so no dead-end screen strands a customer (CUS-P2-04).
 * `primary="cards"` leads with the guest's cards: a QR that isn't working
 * (Q2) is not fixed by scanning again.
 */
export function UnavailableRecoveryActions({
  className,
  scanLabel = "Scan a QR",
  primary = "scan",
}: {
  className?: string
  /** The stamp screen names the QR the guest is standing at ("Scan the QR"). */
  scanLabel?: string
  primary?: "scan" | "cards"
}) {
  const scan = (
    <Button
      asChild
      size="lg"
      variant={primary === "scan" ? "default" : "secondary"}
    >
      <Link href="/scan">{scanLabel}</Link>
    </Button>
  )
  const cards = (
    <Button
      asChild
      size="lg"
      variant={primary === "cards" ? "default" : "secondary"}
    >
      <Link href="/home">{OPEN_MY_CARDS_LABEL}</Link>
    </Button>
  )
  return (
    <div className={cn("grid w-full gap-2", className)}>
      {primary === "cards" ? (
        <>
          {cards}
          {scan}
        </>
      ) : (
        <>
          {scan}
          {cards}
        </>
      )}
    </div>
  )
}
