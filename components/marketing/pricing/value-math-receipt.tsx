import { ReceiptCard } from "@/components/brand"
import { VALUE_MATH } from "@/lib/marketing/facts"

/**
 * ValueMathReceipt — the "does the maths work?" till roll.
 *
 * One object, two call sites (`/pricing` and `/how-it-works`). They used to be
 * two hand-rolled copies of the same three facts at two type scales, one
 * rotated and one not — so the same receipt read as a lesser component on the
 * page where the money is actually discussed. `rotated` is the only knob: the
 * pricing sheet's neighbour sits square, the story page's tilts.
 */
export function ValueMathReceipt({
  rotated = false,
  wrapperClassName,
}: {
  rotated?: boolean
  wrapperClassName?: string
}) {
  return (
    <ReceiptCard
      edge
      rotated={rotated}
      padding="md"
      wrapperClassName={wrapperClassName}
      className="gap-2"
    >
      <p className="mono-meta text-muted-foreground">Does the maths work?</p>
      <p className="text-sm leading-6 text-muted-foreground">
        {VALUE_MATH.assumptionLine}
      </p>
      <p className="text-xl leading-snug font-extrabold text-balance text-foreground sm:text-2xl">
        {VALUE_MATH.coverLine}
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        {VALUE_MATH.illustrativeNote}
      </p>
    </ReceiptCard>
  )
}
