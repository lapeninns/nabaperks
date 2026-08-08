import type { ReactNode } from "react"

import { Eyebrow, MonoTag, ReceiptCard, VenueMark } from "@/components/brand"
import {
  balancedStampColumns,
  RewardSeal,
  RewardTicket,
  StampGrid,
  type RewardSlotState,
  type RewardTicketState,
} from "@/components/loyalty"
import { cn } from "@/lib/utils"

type FlowTone = "accent" | "ink" | "leaf" | "sun" | "plain"

/** Stepped progress for the onboarding wizard. Optional — other routes omit it. */
export type FlowProgress = {
  step: number
  total: number
  label?: string
  /**
   * How far through the CURRENT step we are, 0-1, default 1 (finished).
   *
   * The join wizard maps two screens — phone and code — onto one "verify your
   * number" step, so submitting the phone form successfully left the bar
   * visually unchanged at exactly the point with the highest abandonment risk,
   * which reads as "my submission failed" (CUS 02#51). A half-filled segment
   * lets one step carry two screens honestly.
   */
  stepProgress?: number
}

export function CustomerFlowShell({
  eyebrow,
  title,
  description,
  progress,
  children,
  className,
  dense = false,
  screenLabel = "Customer flow",
}: {
  eyebrow?: ReactNode
  title?: ReactNode
  description?: ReactNode
  progress?: FlowProgress
  children: ReactNode
  className?: string
  /**
   * Tighten the vertical rhythm and headline for the friction-heavy form steps
   * (phone, code, terms) so the primary CTA stays inside the iPhone-SE viewport
   * when the on-screen keyboard is up.
   */
  dense?: boolean
  screenLabel?: string
}) {
  return (
    <main
      className={cn(
        "min-h-[100dvh] overflow-x-hidden bg-background px-4 text-foreground sm:px-6",
        // Bottom padding respects the home-indicator safe area so the last
        // CTA or link never sits clipped against the screen edge
        // (VCU-P3-06/08).
        dense
          ? "pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pt-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          : "pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pt-8 sm:pb-[max(2rem,env(safe-area-inset-bottom))]"
      )}
    >
      <div
        className={cn(
          // One customer column: the shared 410px token (CUS-P2-12/16), so
          // skeleton and content agree at every width.
          "mx-auto grid w-full max-w-customer min-w-0",
          dense ? "gap-4" : "gap-5",
          className
        )}
        data-screen-label={screenLabel}
      >
        <header className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 shrink items-center gap-2">
            <span
              aria-hidden="true"
              className="grid size-7 -rotate-6 place-items-center rounded-full border-2 border-ink bg-primary text-sm leading-none font-extrabold text-primary-foreground shadow-xs"
            >
              ✱
            </span>
            <span className="truncate text-base leading-none font-extrabold tracking-tight">
              nabaperks
            </span>
          </div>
          {/* Hidden on the narrowest viewports (iPhone SE, 320px) where this mono
              pill would otherwise overflow the header and clip off-screen. */}
          {eyebrow ? (
            <MonoTag className="hidden shrink-0 min-[360px]:inline-flex">
              {eyebrow}
            </MonoTag>
          ) : null}
        </header>

        {progress ? <OnboardingProgress progress={progress} /> : null}

        {title || description ? (
          <section className="grid gap-3 text-center">
            {title ? (
              <h1
                className={cn(
                  // Scale steps, not arbitraries. text-[2.1rem]/text-[1.65rem]
                  // were 33.6px/26.4px — two headline sizes that exist in no
                  // scale and in no contract, so /home titles (30px) and /card
                  // titles never lined up. text-3xl matches PageTitle for the
                  // same role; dense drops one step (CUS 02#22).
                  "leading-[1.04] font-extrabold tracking-tight text-balance",
                  dense ? "text-2xl" : "text-3xl"
                )}
              >
                {title}
              </h1>
            ) : null}
            {/* text-sm, not text-[0.96rem]: the contract body size, and the
                size every other customer description already uses. */}
            {description ? (
              <p className="mx-auto max-w-[31ch] text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </section>
        ) : null}

        {children}
      </div>
    </main>
  )
}

function OnboardingProgress({ progress }: { progress: FlowProgress }) {
  const total = Math.max(progress.total, 1)
  const step = Math.min(Math.max(progress.step, 1), total)
  const stepProgress = Math.min(Math.max(progress.stepProgress ?? 1, 0), 1)

  return (
    // The text row ("Step 2 of 3") is real content and stays readable to
    // screen readers; only the decorative bars hide (CUS-P3-03).
    <div className="grid gap-2">
      <div className="mono-id flex items-center justify-between tracking-tag text-muted-foreground">
        <span>{progress.label ?? "Setup"}</span>
        <span>
          Step {step} of {total}
        </span>
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }).map((_, index) => {
          const filled =
            index < step - 1 ? 1 : index === step - 1 ? stepProgress : 0

          return (
            <span
              key={index}
              className="h-1.5 flex-1 overflow-hidden rounded-full border border-ink bg-secondary"
            >
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none"
                style={{ width: `${filled * 100}%` }}
              />
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function CustomerReceipt({
  venueName,
  title,
  eyebrow,
  children,
  metaLines,
  footerLeft,
  footerRight = "ONE STAMP PER BUSINESS DAY",
  hideFooter = false,
  compact = false,
  className,
}: {
  venueName: string
  /**
   * Receipt headline. Omit it so a screen runs a single headline through the
   * shell instead of repeating it here (the "one headline" rule).
   */
  title?: ReactNode
  eyebrow?: ReactNode
  children: ReactNode
  /** Mono receipt lines (saved phone, last stamp date) above the footer rule. */
  metaLines?: ReactNode
  footerLeft?: ReactNode
  footerRight?: ReactNode
  /**
   * Drop the mono footer (card number + stamp-rule line). Screens that surface
   * those technical details elsewhere — e.g. behind a "card details" disclosure
   * on the dashboard — pass this to keep the receipt calm and uncluttered.
   */
  hideFooter?: boolean
  /** Tighter receipt header for narrow merchant preview surfaces. */
  compact?: boolean
  className?: string
}) {
  return (
    <ReceiptCard
      edge
      wrapperClassName="w-full"
      className={cn("grid gap-4", className)}
      data-edge-class="receipt-edge"
    >
      {/* One gap, not a viewport-scoped one. `sm:gap-4` widened this row by 4px
          at a 640px VIEWPORT while the customer column stayed 410px wide — the
          wrong axis, and the last inner viewport variant left inside the capped
          column (CUS 02#6). */}
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1 text-left">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          {title ? (
            <h2
              className={cn(
                "leading-tight font-extrabold text-balance break-words",
                compact ? "text-lg" : "text-xl"
              )}
            >
              {title}
            </h2>
          ) : null}
        </div>
        <VenueMark
          size={compact ? 48 : 58}
          name={venueName}
          className="shrink-0"
        />
      </div>

      <hr className="w-rule" />
      {children}
      {metaLines ? (
        <div className="mono-id grid gap-1 tracking-tag text-muted-foreground">
          {metaLines}
        </div>
      ) : null}

      {hideFooter ? null : (
        <>
          <hr className="w-rule" />
          {/* The mono cells stack deliberately below 420px instead of
              wrapping mid-token ("CARD Nº NP-/0001", orphaned "DAY") —
              VCU-P3-04/12. */}
          <footer className="grid gap-1 min-[420px]:flex min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-3">
            {/* Receipt voice is for real facts: no placeholder card number
                when the caller has none to print (CUS-P2-01). */}
            <span className="mono-id tracking-tag text-muted-foreground">
              {footerLeft}
            </span>
            <span className="mono-id tracking-tag text-muted-foreground min-[420px]:text-right">
              {footerRight}
            </span>
          </footer>
        </>
      )}
    </ReceiptCard>
  )
}

export function CustomerStampCard({
  venueName,
  cardName,
  current,
  total,
  reward,
  slamIndex = -1,
  stampDates,
  metaLines,
  hideFooter = false,
  hideHeaderText = false,
  wrapStamps = true,
  compact = false,
  afterGrid,
  primaryAction,
  children,
  rewardSlot,
  onSlamComplete,
}: {
  venueName: string
  cardName: ReactNode
  current: number
  total: number
  /** The reward as one prize ticket — sealed while collecting, then revealed. */
  reward: {
    state: RewardTicketState
    name: ReactNode
    description?: ReactNode
    readyDate?: string | null
    sealSlammed?: boolean
  }
  slamIndex?: number
  stampDates?: string[]
  metaLines?: ReactNode
  /** Drop the receipt's mono footer (card number + stamp-rule line). */
  hideFooter?: boolean
  /**
   * Drop the receipt's headline text (card name + merchant eyebrow) when the
   * shell already carries that identity, so the stamp grid is the first thing
   * read inside the receipt. The {@link VenueMark} stays as the venue anchor.
   */
  hideHeaderText?: boolean
  /** Wrap stamp slots onto multiple rows in narrow surfaces such as launch preview. */
  /**
   * Balanced wrap (default). `false` restores the width-driven auto-fit row,
   * which fills each row to the measure and leaves a ragged last row — a
   * 6-stamp card plus its reward chip laid out 5 + 2, a 10-stamp card
   * 5 + 5 + 1. (02#27)
   */
  wrapStamps?: boolean
  /** Tighter stamp grid for narrow merchant preview surfaces. */
  compact?: boolean
  /** Slot rendered between the stamp grid and the reward ticket — used for
   * celebrations so the grid stays the receipt's first focal point. */
  afterGrid?: ReactNode
  /**
   * Slot between {@link afterGrid} and the reward ticket. The stamp route puts
   * its press disc here: it used to be the receipt's LAST child, below the
   * ticket, which put the product's primary verb at roughly y 900 on a 667px
   * phone (CUS 02#18). The ticket is motivation and belongs after the act.
   */
  primaryAction?: ReactNode
  children?: ReactNode
  rewardSlot?: RewardSlotState
  onSlamComplete?: () => void
}) {
  // The StampGrid already shows current/total progress, so a separate
  // ProgressTrack underneath was a duplicate readout — one progress signal only.
  // The sealed mystery shows once: as the row's end chip *or*, once revealed,
  // only on the ticket below — never two seals competing in one view.
  // Column count comes from the slot total, not from available width, so the
  // last row is never mostly empty (02#27). Measured before: a 6-stamp card
  // plus its reward chip laid out 5 + 2, and a 10-stamp card 5 + 5 + 1.
  const wrapColumnCount = balancedStampColumns(
    total + (reward.state === "sealed" ? 1 : 0)
  )

  // True when the stamp row is the one showing the sealed mystery.
  const showsLockedRowChip =
    (rewardSlot ?? (reward.state === "sealed" ? "locked" : undefined)) ===
    "locked"

  return (
    <CustomerReceipt
      venueName={venueName}
      title={hideHeaderText ? undefined : cardName}
      eyebrow={hideHeaderText ? undefined : venueName}
      metaLines={metaLines}
      hideFooter={hideFooter}
      compact={compact}
    >
      <StampGrid
        current={current}
        total={total}
        dates={stampDates}
        slamIndex={slamIndex}
        showEmptySlotNumbers
        rewardSlot={
          rewardSlot ?? (reward.state === "sealed" ? "locked" : undefined)
        }
        venueName={venueName}
        layout={wrapStamps ? "wrap" : "row"}
        wrapColumns={wrapColumnCount}
        compact={compact}
        className="py-1"
        onSlamComplete={onSlamComplete}
      />
      {afterGrid}
      {primaryAction}
      <RewardTicket
        state={reward.state}
        name={reward.name}
        description={reward.description}
        readyDate={reward.readyDate}
        sealSlammed={reward.sealSlammed}
        // Honour the invariant three lines above: while the mystery is sealed
        // the stamp row already carries the seal as its terminal chip, so the
        // ticket stub prints the stub word only. Once revealed the row chip is
        // gone and the seal belongs here. (02#31)
        hideStubSeal={showsLockedRowChip}
      />
      {children}
    </CustomerReceipt>
  )
}

export function CustomerRewardSeal({
  revealed,
  caption,
  className,
}: {
  revealed: boolean
  caption: string
  className?: string
}) {
  return (
    <div className={cn("grid justify-items-center gap-3", className)}>
      <RewardSeal state={revealed ? "redeemed" : "sealed"} size="lg" />
      <span className="mono-meta tracking-tag text-muted-foreground">
        {caption}
      </span>
    </div>
  )
}

export function CustomerActionNote({
  tone = "plain",
  title,
  children,
  className,
}: {
  tone?: FlowTone
  title: ReactNode
  children?: ReactNode
  className?: string
}) {
  const dotClass = {
    accent: "bg-primary",
    ink: "bg-ink",
    leaf: "bg-reward",
    sun: "bg-seal",
    plain: "bg-paper-deep",
  }[tone]

  return (
    <section
      className={cn(
        "grid grid-cols-[auto_1fr] gap-3 rounded-lg border-2 border-dashed border-border bg-card p-4 text-left",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn("mt-1 size-3 rounded-full border-2 border-ink", dotClass)}
      />
      <div className="grid gap-1">
        <p className="text-sm leading-snug font-extrabold">{title}</p>
        {children ? (
          <p className="text-sm leading-6 text-muted-foreground">{children}</p>
        ) : null}
      </div>
    </section>
  )
}
