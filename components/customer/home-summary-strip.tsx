import {
  HOME_STAMP_SCAN_NOTE,
  homeSummaryLabels,
} from "@/lib/customer/home-dashboard"
import type { HomeSummary } from "@/lib/customer/home"

/**
 * The wallet's one-line ledger. Labels come from `homeSummaryLabels` so the copy
 * lives beside the computation it describes, and the scan note only appears when
 * a card could still take a stamp — it says what a stamp needs, never that the
 * customer is at the venue or that anything has been earned.
 */
export function HomeSummaryStrip({ summary }: { summary: HomeSummary }) {
  return (
    <div className="grid gap-1 border-y border-dashed border-ink/25 py-2">
      <p className="mono-meta tracking-[0.08em] text-muted-foreground">
        {homeSummaryLabels(summary).join(" / ")}
      </p>
      {summary.stampAvailableCount > 0 ? (
        <p className="text-sm leading-5 text-muted-foreground">
          {HOME_STAMP_SCAN_NOTE}
        </p>
      ) : null}
    </div>
  )
}
