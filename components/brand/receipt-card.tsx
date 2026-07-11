import type { ComponentProps, ReactNode } from "react"

import { WetInkShake } from "@/components/motion"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

const PADDING = {
  none: "[--card-spacing:0]",
  sm: "[--card-spacing:--spacing(4)]",
  md: "[--card-spacing:--spacing(6)]",
  lg: "[--card-spacing:--spacing(8)]",
} as const

type ReceiptCardProps = ComponentProps<typeof Card> & {
  children: ReactNode
  /** Render the perforated zigzag receipt edge below the card. */
  edge?: boolean
  /** Inner padding preset (drives the card spacing variable). */
  padding?: keyof typeof PADDING
  /** Classes on the outer wrapper that also carries the rotation/edge. */
  wrapperClassName?: string
  /** Stamp-family tilt — receipts sit a touch off-square. */
  rotated?: boolean
  /** Fire the paper shake (WetInkShake) on mount — e.g. when a fresh stamp lands. */
  shaken?: boolean
}

/**
 * Receipt surface — the proto's most-used card. Composes the shadcn `Card`
 * primitive (which already carries the Wet Ink ink border + hard offset shadow
 * via the `[data-slot="card"]` layer) and adds the perforated `.receipt-edge`.
 * Use `CardHeader`/`CardContent`/`CardFooter` inside for structured sections.
 */
export function ReceiptCard({
  children,
  edge = false,
  padding = "md",
  className,
  wrapperClassName,
  rotated = false,
  shaken = false,
  ...props
}: ReceiptCardProps) {
  const surface = (
    <>
      <Card
        className={cn(PADDING[padding], "px-(--card-spacing)", className)}
        {...props}
      >
        {children}
      </Card>
      {edge ? <div aria-hidden="true" className="receipt-edge" /> : null}
    </>
  )

  return (
    // min-w-0: as a grid/flex child the wrapper must be allowed to shrink
    // below its content's intrinsic width, or wide descendants (nowrap
    // buttons, long values) push the card past a 320px viewport.
    <div className={cn("min-w-0", rotated && "-rotate-1", wrapperClassName)}>
      {shaken ? <WetInkShake active>{surface}</WetInkShake> : surface}
    </div>
  )
}
