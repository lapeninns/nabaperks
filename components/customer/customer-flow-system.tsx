import type { ReactNode } from "react"

import { Eyebrow, MonoTag, ReceiptCard, VenueMark } from "@/components/brand"
import {
  RewardSeal,
  RewardTicket,
  StampGrid,
  type RewardTicketState,
} from "@/components/loyalty"
import { cn } from "@/lib/utils"

type FlowTone = "accent" | "ink" | "leaf" | "sun" | "plain"

/** Stepped progress for the onboarding wizard. Optional — other routes omit it. */
export type FlowProgress = {
  step: number
  total: number
  label?: string
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
        dense ? "py-4 sm:py-6" : "py-5 sm:py-8"
      )}
    >
      <div
        className={cn(
          "mx-auto grid w-full max-w-[410px]",
          dense ? "gap-4" : "gap-5",
          className
        )}
        data-screen-label={screenLabel}
      >
        <header className="flex items-center justify-between gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="grid size-7 -rotate-6 place-items-center rounded-full border-2 border-ink bg-primary text-sm leading-none font-extrabold text-primary-foreground shadow-xs"
            >
              ✱
            </span>
            <span className="text-base leading-none font-extrabold tracking-tight">
              nabaperks
            </span>
          </div>
          {/* Hidden on the narrowest viewports (iPhone SE, 320px) where this mono
              pill would otherwise overflow the header and clip off-screen. */}
          {eyebrow ? (
            <MonoTag className="hidden min-[360px]:inline-flex">{eyebrow}</MonoTag>
          ) : null}
        </header>

        {progress ? <OnboardingProgress progress={progress} /> : null}

        {title || description ? (
          <section className="grid gap-3 text-center">
            {title ? (
              <h1
                className={cn(
                  "leading-[1.04] font-extrabold tracking-tight text-balance",
                  dense ? "text-[1.65rem]" : "text-[2.1rem]"
                )}
              >
                {title}
              </h1>
            ) : null}
            {description ? (
              <p className="mx-auto max-w-[31ch] text-[0.96rem] leading-6 text-muted-foreground">
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

  return (
    <div className="grid gap-2" aria-hidden="true">
      <div className="flex items-center justify-between font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        <span>{progress.label ?? "Setup"}</span>
        <span>
          Step {step} of {total}
        </span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full border border-ink transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
              index < step ? "bg-primary" : "bg-secondary"
            )}
          />
        ))}
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
  className?: string
}) {
  return (
    <ReceiptCard
      edge
      wrapperClassName="w-full"
      className={cn("grid gap-4", className)}
      data-edge-class="receipt-edge"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1 text-left">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          {title ? (
            <h2 className="text-xl leading-tight font-extrabold text-balance">
              {title}
            </h2>
          ) : null}
        </div>
        <VenueMark size={58} name={venueName} />
      </div>

      <hr className="w-rule" />
      {children}
      {metaLines ? (
        <div className="grid gap-1 font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {metaLines}
        </div>
      ) : null}

      {hideFooter ? null : (
        <>
          <hr className="w-rule" />
          <footer className="flex items-center justify-between gap-3">
            <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              {footerLeft ?? "CARD Nº NP-0001"}
            </span>
            <span className="text-right font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
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
  afterGrid,
  children,
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
  /** Slot rendered between the stamp grid and the reward ticket — used for
   * celebrations so the grid stays the receipt's first focal point. */
  afterGrid?: ReactNode
  children?: ReactNode
}) {
  // The StampGrid already shows current/total progress, so a separate
  // ProgressTrack underneath was a duplicate readout — one progress signal only.
  // The sealed mystery shows once: as the row's end chip *or*, once revealed,
  // only on the ticket below — never two seals competing in one view.
  return (
    <CustomerReceipt
      venueName={venueName}
      title={hideHeaderText ? undefined : cardName}
      eyebrow={hideHeaderText ? undefined : venueName}
      metaLines={metaLines}
      hideFooter={hideFooter}
    >
      <StampGrid
        current={current}
        total={total}
        dates={stampDates}
        slamIndex={slamIndex}
        showEmptySlotNumbers
        rewardSlot={reward.state === "sealed" ? "locked" : undefined}
        venueName={venueName}
        className="py-1"
      />
      {afterGrid}
      <RewardTicket
        state={reward.state}
        name={reward.name}
        description={reward.description}
        readyDate={reward.readyDate}
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
      <span className="font-mono text-[0.68rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
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
