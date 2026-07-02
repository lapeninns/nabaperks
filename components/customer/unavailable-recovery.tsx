import Link from "next/link"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Shared recovery actions for customer unavailable states (`/q`, `/m`, the
 * join wizard): one primary re-entry into the journey (scan the venue QR) and
 * the cards fallback, so no dead-end screen strands a customer (CUS-P2-04).
 */
export function UnavailableRecoveryActions({
  className,
}: {
  className?: string
}) {
  return (
    <div className={cn("grid w-full gap-2", className)}>
      <Button asChild size="lg">
        <Link href="/scan">Scan a QR</Link>
      </Button>
      <Button asChild size="lg" variant="secondary">
        <Link href="/home">Open my cards</Link>
      </Button>
    </div>
  )
}
