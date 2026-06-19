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
  LaunchReadinessTab,
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
 * leaf progress track. Shared by the merchant dashboard and the launch hub so
 * progress reads as one object in both places. `showHeader` is dropped on the
 * hub, where the page already titles it.
 *
 * On the dashboard (no `activeTab`) the spine is a read-only teaser and ends in
 * a single next-step prompt that deep-links into the hub. On the hub, passing
 * `activeTab` turns the four stamps into the tab nav itself: each stamp becomes
 * a link to its tab, the current tab is marked, and the next-step prompt is
 * dropped — the active panel already sits directly below.
 */
export function LaunchReadinessPanel({
  readiness,
  showHeader = true,
  activeTab,
  className,
}: {
  readiness: LaunchReadiness
  /** Render the "Launch readiness" section header (on by default). */
  showHeader?: boolean
  /** Set on the launch hub to drive tab nav from the stamps themselves. */
  activeTab?: LaunchReadinessTab
  className?: string
}) {
  const nextStep = readiness.nextStep
  const tabMode = activeTab !== undefined

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
          const isActive = tabMode && step.tab === activeTab

          const inner = (
            <>
              <LaunchStepStamp
                glyph={STEP_ICON[step.id]}
                ready={step.ready}
                isNext={isNext}
                active={isActive}
              />
              <span className="text-xs font-extrabold sm:text-sm">
                <span className="hidden font-mono text-[0.6rem] text-muted-foreground sm:inline">
                  {index + 1}.{" "}
                </span>
                {STEP_SHORT[step.id]}
              </span>
              <span
                className={cn(
                  "font-mono text-[0.58rem] font-bold tracking-[0.06em] uppercase",
                  step.ready
                    ? "text-reward"
                    : isNext || isActive
                      ? "text-foreground"
                      : "text-muted-foreground"
                )}
              >
                {step.ready ? "Ready" : isNext ? "Next up" : "To do"}
              </span>
            </>
          )

          // Stamps are always links to their tab: on the hub they switch the
          // active panel below; on the dashboard teaser they deep-link into the
          // hub. Only hub tab mode marks one as the current page.
          return (
            <li key={step.id} className="grid">
              <Link
                href={`/app/launch?tab=${step.tab}`}
                aria-current={
                  isActive ? "page" : !tabMode && isNext ? "step" : undefined
                }
                aria-label={`${step.label}, ${step.ready ? "ready" : "to do"}`}
                className="grid justify-items-center gap-2 rounded-lg px-1 py-2 text-center transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none"
              >
                {inner}
              </Link>
            </li>
          )
        })}
      </ol>

      <ProgressTrack
        current={readiness.completed}
        total={readiness.total}
        label="Stamped"
      />

      {!tabMode && !readiness.launchReady ? (
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
 * sun-ringed glyph for the next step, and a dashed empty slot for the rest. In
 * the hub's tab mode the selected step also carries a solid ink ring so the
 * active tab reads as "you are here", distinct from the lighter focus ring.
 */
function LaunchStepStamp({
  glyph,
  ready,
  isNext,
  active = false,
}: {
  glyph: IconGlyph
  ready: boolean
  isNext: boolean
  active?: boolean
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
            : "border-dashed border-ink/35 bg-secondary/60 text-muted-foreground",
        active && "ring-2 ring-ink ring-offset-2 ring-offset-card"
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
