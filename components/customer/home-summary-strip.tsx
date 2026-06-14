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
    <div className="rounded-[var(--radius)] border-2 border-dashed border-ink/25 bg-card px-4 py-3 font-mono text-[0.68rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
      {parts.join(" / ")}
    </div>
  )
}
