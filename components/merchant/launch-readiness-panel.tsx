import Link from "next/link"

import { MonoTag, ReceiptCard, SectionHeader } from "@/components/brand"
import { Button } from "@/components/ui/button"
import type { LaunchReadiness } from "@/lib/merchant/launch-readiness"
import { cn } from "@/lib/utils"

export function LaunchReadinessPanel({
  readiness,
}: {
  readiness: LaunchReadiness
}) {
  const nextStep = readiness.nextStep
  const progress = Math.round((readiness.completed / readiness.total) * 100)

  return (
    <ReceiptCard edge className="grid gap-5 overflow-hidden">
      <SectionHeader
        eyebrow="Ink progress"
        title="Launch readiness"
        description="A live checklist from card, reward, staff, station, and QR records."
        actions={
          <MonoTag tone={readiness.launchReady ? "leaf" : "sun"}>
            {readiness.completed} of {readiness.total} ready
          </MonoTag>
        }
      />

      <div
        aria-label={`Launch readiness ${progress}%`}
        className="h-3 overflow-hidden rounded-full border-2 border-ink bg-paper-deep"
        role="meter"
        aria-valuenow={readiness.completed}
        aria-valuemin={0}
        aria-valuemax={readiness.total}
      >
        <div className="h-full bg-reward" style={{ width: `${progress}%` }} />
      </div>

      <ol className="grid gap-2 sm:grid-cols-5">
        {readiness.steps.map((step, index) => (
          <li
            key={step.id}
            className={cn(
              "grid gap-3 rounded-lg border-2 p-3",
              step.ready
                ? "border-ink bg-card"
                : "border-dashed border-ink/30 bg-secondary/60"
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-mono text-[0.65rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                Step {index + 1}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-7 place-items-center rounded-full border-2 border-ink font-extrabold",
                  step.ready ? "bg-reward text-reward-foreground" : "bg-card"
                )}
              >
                {step.ready ? "✓" : "·"}
              </span>
            </span>
            <span className="grid gap-1">
              <span className="text-sm font-extrabold">{step.label}</span>
              <span className="text-xs leading-5 text-muted-foreground">
                {step.summary}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-ink bg-ink px-4 py-3 text-paper">
        <p className="max-w-xl text-sm leading-6 text-paper/80">
          {readiness.launchReady
            ? "The venue can accept scans, issue stamps, and redeem rewards."
            : nextStep
              ? `${nextStep.label} is the next launch blocker.`
              : "Review the launch checklist before printing."}
        </p>
        <Button asChild variant="secondary" size="sm">
          <Link href={nextStep?.href ?? "/app/launch"}>
            {nextStep?.actionLabel ?? "Open launch"}
          </Link>
        </Button>
      </div>
    </ReceiptCard>
  )
}
