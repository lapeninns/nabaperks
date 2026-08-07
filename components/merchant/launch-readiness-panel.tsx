import Link from "next/link"
import {
  ArrowRight02Icon,
  CheckmarkBadge04Icon,
  CreditCardIcon,
  GiftIcon,
  MapPinIcon,
  QrCode01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"

import {
  Icon,
  type IconGlyph,
  MonoTag,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { Progress } from "@/components/ui/progress"
import { ProgressTrack } from "@/components/loyalty/progress-track"
import { RewardSeal } from "@/components/loyalty/reward-seal"
import { Button } from "@/components/ui/button"
import type {
  LaunchReadiness,
  LaunchHubTab,
  LaunchReadinessAction,
} from "@/lib/merchant/launch-readiness"
import type { LaunchChecklistStepId } from "@/lib/merchant/launch-readiness-contract"
import { MERCHANT_SETUP_STEPS } from "@/lib/merchant/launch-readiness-contract"
import { cn } from "@/lib/utils"

export type LaunchReadinessPanelVariant = "full" | "compact"

/** Each checklist step reaches for the same glyph everywhere it appears. */
const STEP_ICON: Record<LaunchChecklistStepId, IconGlyph> = {
  venue: MapPinIcon,
  card: CreditCardIcon,
  rewards: GiftIcon,
  qr: QrCode01Icon,
  billing: Settings01Icon,
}

const MOBILE_RAIL_LABEL: Record<LaunchChecklistStepId, string> = {
  venue: "Venue",
  card: "Card",
  rewards: "Rewards",
  qr: "Venue QR",
  billing: "Billing",
}

/** Shorter rail labels for 320–359px viewports so five steps fit without clipping. */
const MOBILE_RAIL_LABEL_NARROW: Record<LaunchChecklistStepId, string> = {
  venue: "Venue",
  card: "Card",
  rewards: "Pool",
  qr: "QR",
  billing: "Bill",
}

function mobileRailColumnClass(count: number) {
  if (count >= 5) return "grid-cols-5"
  if (count === 4) return "grid-cols-4"
  return "grid-cols-3"
}

function launchStepStateLabel(step: LaunchReadinessAction, isNext: boolean) {
  return step.ready ? "ready" : isNext ? "next up" : "to do"
}

/**
 * The launch readiness spine — setup steps drawn as a stamp row over a leaf
 * progress track. Venue leads (captured during onboarding), then card, rewards,
 * billing when required, and QR. Shared by the merchant dashboard and launch hub.
 */
export function LaunchReadinessPanel({
  readiness,
  showHeader = true,
  activeTab,
  className,
  variant = "full",
}: {
  readiness: LaunchReadiness
  /** Render the "Launch readiness" section header (on by default). */
  showHeader?: boolean
  /** Set on the launch hub to drive tab nav from the stamps themselves. */
  activeTab?: LaunchHubTab
  className?: string
  /** Compact mode is a single CTA strip; full mode renders the stamp checklist. */
  variant?: LaunchReadinessPanelVariant
}) {
  const nextStep = readiness.nextStep
  const tabMode = activeTab !== undefined
  const checklist = readiness.checklist

  if (variant === "compact") {
    if (readiness.launchReady) {
      return null
    }

    return (
      <>
        {tabMode ? (
          <LaunchMobileTabNav
            readiness={readiness}
            checklist={checklist}
            nextStep={nextStep}
            activeTab={activeTab}
            progressValue={readinessProgressValue(readiness)}
          />
        ) : null}
        <LaunchReadinessCompact
          readiness={readiness}
          nextStep={nextStep}
          className={cn(tabMode && "hidden sm:grid", className)}
        />
      </>
    )
  }

  const columnClass =
    checklist.length === 5
      ? "grid-cols-2 sm:grid-cols-5"
      : checklist.length === 4
        ? "grid-cols-2 sm:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3"
  const progressValue = readinessProgressValue(readiness)

  return (
    <>
      {tabMode ? (
        <LaunchMobileTabNav
          readiness={readiness}
          checklist={checklist}
          nextStep={nextStep}
          activeTab={activeTab}
          progressValue={progressValue}
        />
      ) : null}

      <ReceiptCard
        edge
        padding="sm"
        className={cn(
          "grid gap-2 overflow-hidden sm:gap-5 sm:[--card-spacing:--spacing(6)]",
          tabMode && "hidden sm:grid",
          className
        )}
      >
        {showHeader ? (
          <SectionHeader
            eyebrow="Setup"
            title="Setup readiness"
            description="What's left before members can collect stamps."
            actions={
              <MonoTag tone={readiness.launchReady ? "leaf" : "sun"}>
                {readiness.completed} of {readiness.total} complete
              </MonoTag>
            }
          />
        ) : null}

        {readiness.launchReady ? (
          <>
            <div className="hidden items-center gap-4 rounded-lg border-2 border-reward bg-reward/10 p-4 sm:flex">
              <RewardSeal state="redeemed" size="md" label="Venue is live" />
              <div className="grid gap-1">
                <span className="eyebrow text-reward">You&apos;re live</span>
                <p className="text-base font-extrabold">
                  Setup is complete. Customers can scan, join, and collect
                  stamps.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border-2 border-reward bg-reward/10 px-3 py-2 sm:hidden">
              <RewardSeal state="redeemed" size="sm" label="Venue is live" />
              <p className="text-sm font-extrabold">You&apos;re live</p>
            </div>
          </>
        ) : null}

        {!tabMode ? (
          <div className="grid gap-2 sm:hidden">
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow">Setup progress</span>
              <MonoTag tone="leaf" className="numeric-tabular">
                {readiness.completed} / {readiness.total}
              </MonoTag>
            </div>
            {/* Track/fill colours come from the unlayered [data-slot=progress]
                rules — only the height stays per call site. */}
            <Progress
              value={progressValue}
              aria-label={`Setup progress: ${readiness.completed} of ${readiness.total}`}
              className="h-1.5"
            />
            <LaunchStepRail
              checklist={checklist}
              nextStep={nextStep}
              activeTab={activeTab}
              tabMode={tabMode}
            />
          </div>
        ) : null}

        <nav
          aria-label="Merchant setup steps"
          className="hidden gap-2 sm:grid sm:gap-3"
        >
          {tabMode ? (
            <p className="eyebrow text-muted-foreground">Choose a setup step</p>
          ) : null}
          <ol className={cn("grid gap-2 sm:gap-3", columnClass)}>
            {checklist.map((step, index) => {
              const isNext = !step.ready && step.id === nextStep?.id
              const isActive = tabMode && step.tab === activeTab
              const stepIcon = STEP_ICON[step.id]
              const stateLabel = launchStepStateLabel(step, isNext)

              const inner = (
                <>
                  <LaunchStepStamp
                    glyph={stepIcon}
                    ready={step.ready}
                    isNext={isNext}
                    active={isActive}
                  />
                  <span className="text-xs font-extrabold sm:text-sm">
                    <span className="mono-id hidden text-muted-foreground sm:inline">
                      {index + 1}.{" "}
                    </span>
                    {step.label}
                  </span>
                  <span
                    className={cn(
                      "mono-id",
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

              return (
                <li key={step.id} className="grid">
                  <Link
                    href={step.href}
                    prefetch={false}
                    aria-current={
                      isActive
                        ? "page"
                        : !tabMode && isNext
                          ? "step"
                          : undefined
                    }
                    aria-label={`${step.label}, ${stateLabel}`}
                    className="focus-ring grid min-h-11 justify-items-center gap-2 rounded-lg px-1 py-2 text-center transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none hover:bg-accent motion-reduce:transition-none"
                  >
                    {inner}
                  </Link>
                </li>
              )
            })}
          </ol>
        </nav>

        <ProgressTrack
          current={readiness.completed}
          total={readiness.total}
          label="Setup progress"
          className="hidden sm:grid"
        />

        {!tabMode && !readiness.launchReady ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-ink bg-ink px-4 py-3 text-paper">
            <p className="max-w-xl text-sm leading-6 text-paper/80">
              {nextStep
                ? `Next up: ${nextStep.actionLabel}.`
                : "Run through the checklist before you print."}
            </p>
            <Button asChild variant="secondary">
              <Link href={nextStep?.href ?? "/app/launch"} prefetch={false}>
                {nextStep?.actionLabel ?? "Open setup"}
                <Icon icon={ArrowRight02Icon} size={15} />
              </Link>
            </Button>
          </div>
        ) : null}
      </ReceiptCard>
    </>
  )
}

function readinessProgressValue(readiness: LaunchReadiness) {
  if (readiness.total <= 0) {
    return 0
  }

  return Math.min(
    Math.max((readiness.completed / readiness.total) * 100, 0),
    100
  )
}

function LaunchReadinessCompact({
  readiness,
  nextStep,
  className,
}: {
  readiness: LaunchReadiness
  nextStep: LaunchReadinessAction | null
  className?: string
}) {
  const progressValue = readinessProgressValue(readiness)
  const stepHint =
    MERCHANT_SETUP_STEPS.find((step) => step.id === nextStep?.id)
      ?.description ??
    "Complete the remaining steps before customers can collect stamps."

  return (
    <ReceiptCard
      edge
      padding="sm"
      className={cn(
        "grid gap-3 overflow-hidden sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:[--card-spacing:--spacing(5)]",
        className
      )}
    >
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MonoTag tone="sun" className="numeric-tabular">
            {readiness.completed} of {readiness.total} complete
          </MonoTag>
          <span className="eyebrow">Setup</span>
        </div>
        <div className="grid gap-1">
          <p className="text-base leading-snug font-extrabold text-balance">
            {nextStep ? `Next: ${nextStep.label}` : "Finish setup to go live"}
          </p>
          <p className="text-sm leading-6 text-pretty text-muted-foreground">
            {stepHint}
          </p>
        </div>
        <Progress
          value={progressValue}
          aria-label={`Setup progress: ${readiness.completed} of ${readiness.total}`}
          className="h-1.5 sm:max-w-xs"
        />
      </div>
      <Button asChild className="w-full shrink-0 sm:w-auto">
        <Link href={nextStep?.href ?? "/app/launch"} prefetch={false}>
          {nextStep?.actionLabel ?? "Open setup"}
          <Icon icon={ArrowRight02Icon} size={15} />
        </Link>
      </Button>
    </ReceiptCard>
  )
}

/** Sticky step rail for launch hub tabs — no receipt card chrome on small screens. */
function LaunchMobileTabNav({
  readiness,
  checklist,
  nextStep,
  activeTab,
  progressValue,
}: {
  readiness: LaunchReadiness
  checklist: LaunchReadinessAction[]
  nextStep: LaunchReadinessAction | null
  activeTab: LaunchHubTab
  progressValue: number
}) {
  return (
    <div className="sticky top-(--setup-header-h) z-20 w-full min-w-0 overflow-x-clip border-b-2 border-ink/10 bg-background py-1.5 sm:hidden">
      {!readiness.launchReady ? (
        <div className="mb-1.5 flex min-w-0 items-center gap-2">
          <Progress
            value={progressValue}
            aria-label={`Setup progress: ${readiness.completed} of ${readiness.total}`}
            className="h-1 min-w-0 flex-1"
          />
          <MonoTag
            tone="leaf"
            className="numeric-tabular shrink-0 px-1.5 py-0.5"
          >
            {readiness.completed}/{readiness.total}
          </MonoTag>
        </div>
      ) : null}
      <LaunchStepRail
        checklist={checklist}
        nextStep={nextStep}
        activeTab={activeTab}
        tabMode
        compact
      />
    </div>
  )
}

function LaunchStepRail({
  checklist,
  nextStep,
  activeTab,
  tabMode,
  compact = false,
}: {
  checklist: LaunchReadinessAction[]
  nextStep: LaunchReadinessAction | null
  activeTab?: LaunchHubTab
  tabMode: boolean
  compact?: boolean
}) {
  const columnClass = mobileRailColumnClass(checklist.length)

  return (
    <nav aria-label="Merchant setup steps" className="min-w-0 overflow-x-clip">
      {tabMode ? (
        <p className="eyebrow mb-1 text-muted-foreground">
          Choose a setup step
        </p>
      ) : null}
      <ol
        className={cn(
          "grid w-full min-w-0",
          compact ? "gap-1" : "gap-1.5",
          columnClass
        )}
      >
        {checklist.map((step) => {
          const isNext = !step.ready && step.id === nextStep?.id
          const isActive = tabMode && step.tab === activeTab
          const stepIcon = STEP_ICON[step.id]
          const stateLabel = launchStepStateLabel(step, isNext)

          return (
            <li key={step.id} className="min-w-0">
              <Link
                href={step.href}
                prefetch={false}
                aria-current={
                  isActive ? "page" : !tabMode && isNext ? "step" : undefined
                }
                aria-label={`${step.label}, ${stateLabel}`}
                className={cn(
                  "pressable focus-ring flex min-h-11 w-full min-w-0 flex-col items-center rounded-lg border-2 transition-[border-color,background-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none motion-reduce:transition-none",
                  compact
                    ? "gap-0.5 px-0.5 py-1 min-[360px]:gap-1 min-[360px]:px-1 min-[360px]:py-1.5"
                    : "gap-1 px-1 py-1.5",
                  isActive && "border-ink bg-accent shadow-xs",
                  !isActive && isNext && "border-seal bg-card",
                  !isActive &&
                    !isNext &&
                    step.ready &&
                    "border-ink/20 bg-secondary/50",
                  !isActive &&
                    !isNext &&
                    !step.ready &&
                    "border-dashed border-ink/25 bg-secondary/30"
                )}
              >
                <LaunchStepStamp
                  glyph={stepIcon}
                  ready={step.ready}
                  isNext={isNext}
                  active={isActive}
                  size="xs"
                />
                {/* Rail captions print at the sanctioned mono-id floor (10px
                    mono uppercase) — the old 8.8-9.9px Bricolage sizes sat
                    below the DESIGN.md micro-type floor. */}
                <span className="mono-id w-full text-center leading-tight text-balance">
                  <span className="min-[360px]:hidden">
                    {MOBILE_RAIL_LABEL_NARROW[step.id]}
                  </span>
                  <span className="hidden min-[360px]:inline">
                    {MOBILE_RAIL_LABEL[step.id]}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
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
  size = "md",
}: {
  glyph: IconGlyph
  ready: boolean
  isNext: boolean
  active?: boolean
  size?: "xs" | "sm" | "md"
}) {
  const iconSize = size === "xs" ? 14 : size === "sm" ? 18 : ready ? 24 : 22

  return (
    <span
      aria-hidden="true"
      data-stamp-earned={ready ? "true" : undefined}
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full border-2",
        size === "xs" && "size-7 min-[360px]:size-8",
        size === "sm" && "size-10",
        size === "md" && "size-12 sm:size-14",
        ready
          ? "border-ink bg-stamp text-stamp-foreground shadow-sm"
          : isNext
            ? "border-seal bg-card text-foreground shadow-xs"
            : "border-dashed border-ink/35 bg-secondary/60 text-muted-foreground",
        active &&
          (size === "xs"
            ? "ring-2 ring-ink ring-inset"
            : "ring-2 ring-ink ring-offset-1 ring-offset-card")
      )}
    >
      <span className="relative z-[1] grid place-items-center">
        <Icon
          icon={ready ? CheckmarkBadge04Icon : glyph}
          size={iconSize}
          strokeWidth={2.25}
        />
      </span>
    </span>
  )
}
