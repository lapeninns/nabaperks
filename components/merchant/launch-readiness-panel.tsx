import Link from "next/link"
import {
  ArrowRight02Icon,
  CheckmarkBadge04Icon,
  CreditCardIcon,
  GiftIcon,
  MapPinIcon,
  QrCode01Icon,
} from "@hugeicons/core-free-icons"

import {
  Icon,
  type IconGlyph,
  MonoTag,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { ProgressTrack } from "@/components/loyalty/progress-track"
import { RewardSeal } from "@/components/loyalty/reward-seal"
import { Button } from "@/components/ui/button"
import type {
  LaunchReadiness,
  LaunchReadinessStepId,
} from "@/lib/merchant/launch-readiness"
import { cn } from "@/lib/utils"

/** Each launch step reaches for the same glyph everywhere it appears. */
const STEP_ICON: Record<LaunchReadinessStepId, IconGlyph> = {
  card: CreditCardIcon,
  rewards: GiftIcon,
  venue: MapPinIcon,
  qr: QrCode01Icon,
}

const STEP_SHORT: Record<LaunchReadinessStepId, string> = {
  card: "Card",
  rewards: "Reward",
  venue: "Venue",
  qr: "QR",
}

/**
 * The launch readiness spine — the four setup steps drawn as a stamp row over a
 * leaf progress track, ending in one single next-step prompt. Shared by the
 * merchant dashboard and the launch hub so progress reads as one object in both
 * places. `showHeader` is dropped on the hub, where the page already titles it.
 */
export function LaunchReadinessPanel({
  readiness,
  showHeader = true,
  className,
}: {
  readiness: LaunchReadiness
  /** Render the "Launch readiness" section header (on by default). */
  showHeader?: boolean
  className?: string
}) {
  const nextStep = readiness.nextStep

  return (
    <ReceiptCard edge className={cn("grid gap-5 overflow-hidden", className)}>
      {showHeader ? (
        <SectionHeader
          eyebrow="Ink progress"
          title="Launch readiness"
          description="What is left before customers can start collecting stamps."
          actions={
            <MonoTag tone={readiness.launchReady ? "leaf" : "sun"}>
              {readiness.completed} of {readiness.total} ready
            </MonoTag>
          }
        />
      ) : null}

      {readiness.launchReady ? (
        <div className="flex items-center gap-4 rounded-lg border-2 border-reward bg-reward/10 p-4">
          <RewardSeal state="redeemed" size="md" label="Venue is live" />
          <div className="grid gap-1">
            <span className="eyebrow text-reward">You&apos;re live</span>
            <p className="text-base font-extrabold">
              All four stamps are in. Customers can scan, join, and collect.
            </p>
          </div>
        </div>
      ) : null}

      <ol className="grid grid-cols-4 gap-2 sm:gap-3">
        {readiness.steps.map((step, index) => {
          const isNext = !step.ready && step.id === nextStep?.id

          return (
            <li
              key={step.id}
              className="grid justify-items-center gap-2 text-center"
              aria-current={isNext ? "step" : undefined}
            >
              <LaunchStepStamp
                glyph={STEP_ICON[step.id]}
                ready={step.ready}
                isNext={isNext}
              />
              <span className="text-xs font-extrabold sm:text-sm">
                <span className="font-mono text-[0.6rem] text-muted-foreground">
                  {index + 1}.{" "}
                </span>
                {STEP_SHORT[step.id]}
              </span>
              <span
                className={cn(
                  "font-mono text-[0.58rem] font-bold tracking-[0.06em] uppercase",
                  step.ready
                    ? "text-reward"
                    : isNext
                      ? "text-foreground"
                      : "text-muted-foreground"
                )}
              >
                {step.ready ? "Ready" : isNext ? "Next up" : "To do"}
              </span>
            </li>
          )
        })}
      </ol>

      <ProgressTrack
        current={readiness.completed}
        total={readiness.total}
        label="Stamped"
      />

      {!readiness.launchReady ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-ink bg-ink px-4 py-3 text-paper">
          <p className="max-w-xl text-sm leading-6 text-paper/80">
            {nextStep
              ? `${nextStep.label} is the next thing to set up.`
              : "Run through the checklist before you print."}
          </p>
          <Button asChild variant="secondary" size="sm">
            <Link href={nextStep?.href ?? "/app/launch"}>
              {nextStep?.actionLabel ?? "Open launch"}
              <Icon icon={ArrowRight02Icon} size={15} />
            </Link>
          </Button>
        </div>
      ) : null}
    </ReceiptCard>
  )
}

/**
 * A single step rendered in the stamp family: a solid vermillion disc once the
 * step is ready (carrying the shared `data-stamp-earned` perforation + tilt), a
 * sun-ringed glyph for the next step, and a dashed empty slot for the rest.
 */
function LaunchStepStamp({
  glyph,
  ready,
  isNext,
}: {
  glyph: IconGlyph
  ready: boolean
  isNext: boolean
}) {
  return (
    <span
      aria-hidden="true"
      data-stamp-earned={ready ? "true" : undefined}
      className={cn(
        "relative grid size-12 place-items-center overflow-hidden rounded-full border-2 sm:size-14",
        ready
          ? "border-ink bg-stamp text-stamp-foreground shadow-sm"
          : isNext
            ? "border-seal bg-card text-foreground shadow-xs"
            : "border-dashed border-ink/35 bg-secondary/60 text-muted-foreground"
      )}
    >
      <span className="relative z-[1] grid place-items-center">
        <Icon
          icon={ready ? CheckmarkBadge04Icon : glyph}
          size={ready ? 24 : 22}
          strokeWidth={2.25}
        />
      </span>
    </span>
  )
}
