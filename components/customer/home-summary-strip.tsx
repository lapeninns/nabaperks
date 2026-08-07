import type { HomeSummary } from "@/lib/customer/home"

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function HomeSummaryStrip({ summary }: { summary: HomeSummary }) {
  const parts = [
    countLabel(summary.cardCount, "card"),
    countLabel(summary.redeemableCount, "reward ready", "rewards ready"),
    countLabel(summary.stampAvailableCount, "stamp today", "stamps today"),
  ]

  return (
    // `border-ink/25` was a third dashed tone (the contract sanctions --w-line
    // at 18% and --w-line-strong at 50%, exposed as border-line /
    // border-line-strong); `rounded-[var(--radius)]` was an arbitrary value for
    // what `rounded-lg` already is; and `tracking-[0.08em]` silently overrode
    // the 0.06em that .mono-meta defines (CUS 02#9).
    <div className="mono-meta rounded-lg border-2 border-dashed border-line bg-card px-4 py-3 text-muted-foreground">
      {parts.join(" / ")}
    </div>
  )
}
