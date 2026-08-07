import type { ReactNode } from "react"

import { ReceiptCard } from "@/components/brand"
import { CustomerTabBar, TAB_BAR_CLEARANCE } from "@/components/layout"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Customer loading skeletons — the source of truth for every customer-surface
 * `loading.tsx`. Each mirrors the *structure* of the surface it stands in for
 * (the real 410px flow shell, the stamp-grid row, the reward-ticket chit) so the
 * swap to real content never shifts the layout, matching the merchant pattern in
 * `components/merchant/loading-skeletons.tsx`.
 *
 * Appearance (rounding + ink-tinted fill) is owned once by the Wet Ink
 * `[data-slot="skeleton"]` layer in `app/globals.css`; usages here set only
 * dimensions, layout, and the occasional `rounded-full` for stamps and marks.
 */

// ─── Flow shell ────────────────────────────────────────────────────────────────

/**
 * Mirrors {@link CustomerFlowShell}: the 410px column, the static ✱ + nabaperks
 * header (rendered for real so it never reflows), and skeletons for the eyebrow
 * tag, headline, and support line.
 */
function CustomerFlowShellSkeleton({
  dense = false,
  className,
  children,
}: {
  dense?: boolean
  className?: string
  children?: ReactNode
}) {
  return (
    <main
      className={cn(
        "min-h-[100dvh] overflow-x-hidden bg-background px-4 text-foreground sm:px-6",
        // Mirrors CustomerFlowShell's safe-area bottom padding so the
        // skeleton→content swap never shifts (VCU-P3-06/08 parity).
        dense
          ? "pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pt-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          : "pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pt-8 sm:pb-[max(2rem,env(safe-area-inset-bottom))]"
      )}
      role="status"
      aria-label="Loading"
    >
      <div
        className={cn(
          // Same token as the real CustomerFlowShell (CUS-P2-16) so the
          // skeleton→content swap never jumps width.
          "mx-auto grid w-full max-w-customer",
          dense ? "gap-4" : "gap-5",
          className
        )}
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
          <Skeleton className="hidden h-6 w-24 rounded-full min-[360px]:block" />
        </header>

        <section className="grid justify-items-center gap-3">
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </section>

        {children}
      </div>
    </main>
  )
}

/** The receipt's reward-ticket chit: face + dashed tear-line + seal stub. */
function RewardTicketSkeleton() {
  return (
    <div className="surface-card-flat flex overflow-hidden">
      <div className="grid flex-1 content-center gap-2 p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-36 max-w-full" />
        <Skeleton className="h-4 w-full max-w-[12rem]" />
      </div>
      <span
        aria-hidden="true"
        className="border-l-2 border-dashed border-line-strong"
      />
      <div className="grid w-[84px] content-center justify-items-center gap-2 p-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}

/** A row of stamp discs mirroring {@link StampGrid}. */
function StampRowSkeleton({ size = "size-12" }: { size?: string }) {
  return (
    <div className="flex flex-wrap gap-2 py-1">
      {[0, 1, 2, 3, 4].map((slot) => (
        <Skeleton key={slot} className={cn(size, "rounded-full")} />
      ))}
    </div>
  )
}

// ─── Card surface ────────────────────────────────────────────────────────────

/**
 * Mirrors the card route ({@link CustomerCardExperience} → collecting panel):
 * flow shell, the back link, a receipt with the stamp row and reward ticket, the
 * action band, and the persistent tab bar.
 */
export function CustomerCardSkeleton() {
  return (
    <>
      <CustomerFlowShellSkeleton className={TAB_BAR_CLEARANCE}>
        <div className="grid gap-4">
          <Skeleton className="h-4 w-24" />
          <ReceiptCard edge className="grid gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="grid min-w-0 flex-1 gap-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-40 max-w-full" />
              </div>
              <Skeleton className="size-[58px] shrink-0 rounded-full" />
            </div>
            <hr className="w-rule" />
            <StampRowSkeleton />
            <RewardTicketSkeleton />
            <Skeleton className="h-16 w-full" />
          </ReceiptCard>
        </div>
      </CustomerFlowShellSkeleton>
      <CustomerTabBar />
    </>
  )
}

// ─── Reward surface ──────────────────────────────────────────────────────────

/**
 * Mirrors the reward route ({@link RewardReadyPanel} and friends): flow shell, a
 * receipt with the reward ticket, a status banner, and the collection QR frame.
 */
export function CustomerRewardSkeleton() {
  return (
    <>
      <CustomerFlowShellSkeleton className={TAB_BAR_CLEARANCE}>
        <ReceiptCard edge className="grid gap-4">
          <div className="flex items-start justify-between gap-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="size-[58px] shrink-0 rounded-full" />
          </div>
          <hr className="w-rule" />
          <RewardTicketSkeleton />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="aspect-square w-full max-w-[220px] justify-self-center" />
        </ReceiptCard>
      </CustomerFlowShellSkeleton>
      <CustomerTabBar />
    </>
  )
}

// ─── QR resolve ──────────────────────────────────────────────────────────────

/**
 * Mirrors the brief `/q/[qrId]` resolve screen before it redirects to join or
 * stamp-confirm. That route does real blocking I/O (resolve + scan rate-limit +
 * membership lookup) at the highest-traffic entry point, so without a loader the
 * scan-to-card moment freezes on the previous page. A calm receipt placeholder —
 * no tab bar, since the customer is still being routed — shows movement instead.
 */
export function CustomerResolveSkeleton() {
  return (
    <CustomerFlowShellSkeleton className="content-center">
      <ReceiptCard edge className="grid gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-40 max-w-full" />
          </div>
          <Skeleton className="size-[58px] shrink-0 rounded-full" />
        </div>
        <hr className="w-rule" />
        <StampRowSkeleton />
        <RewardTicketSkeleton />
      </ReceiptCard>
    </CustomerFlowShellSkeleton>
  )
}

// ─── Merchant landing & join ───────────────────────────────────────────────────

/** Mirrors `/m/[merchantSlug]`: dense flow shell, identity receipt, two CTAs. */
export function CustomerLandingSkeleton() {
  return (
    <CustomerFlowShellSkeleton dense className="content-center">
      <ReceiptCard edge className="grid gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-36 max-w-full" />
          </div>
          <Skeleton className="size-[58px] shrink-0 rounded-full" />
        </div>
        <hr className="w-rule" />
        <StampRowSkeleton />
        <RewardTicketSkeleton />
      </ReceiptCard>
      <div className="grid gap-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </CustomerFlowShellSkeleton>
  )
}

/** Mirrors the `/m/[merchantSlug]/join` welcome step: shell, preview, CTA. */
export function CustomerJoinSkeleton() {
  return (
    <CustomerFlowShellSkeleton>
      <ReceiptCard edge className="grid gap-4">
        <Skeleton className="h-36 w-full" />
        <RewardTicketSkeleton />
      </ReceiptCard>
      <Skeleton className="h-12 w-full" />
    </CustomerFlowShellSkeleton>
  )
}

// ─── Home (authed) ─────────────────────────────────────────────────────────────

/** Mirrors {@link PageTitle}: eyebrow, title, and support line. */
export function CustomerPageTitleSkeleton() {
  return (
    <section className="grid gap-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-48 max-w-full" />
      <Skeleton className="h-4 w-full max-w-sm" />
    </section>
  )
}

/**
 * Mirrors the home dashboard: the compact heading row and a stack of
 * {@link HomeCardTile} receipts. Rendered inside the persistent
 * {@link CustomerAppShell}, so it omits the shell and tab bar (the layout
 * already holds them).
 *
 * The measurements here are taken from the real components, not chosen: this
 * file's own promise is that "the swap to real content never shifts the
 * layout", and it was not keeping it (CUS 02#16). It used `gap-5`/`gap-3.5`
 * where the page is `gap-5`/`gap-4`; it drew a `ReceiptCard edge` (a 12px
 * perforation) and an `<hr class="w-rule">` (28px of margin) that HomeCardTile
 * does not render at all; and it omitted the tag row and the `bg-accent p-3`
 * stamp well that it does. Each tile jumped ~40px on arrival. Now: no edge, no
 * rule, the real gaps, a tag-row block and the accent stamp well.
 */
export function CustomerHomeSkeleton() {
  return (
    <div className="grid gap-5" role="status" aria-label="Loading your cards">
      {/* The heading row: one h1-sized line plus the summary eyebrow. */}
      <div className="grid gap-1.5">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-3 w-52 max-w-full" />
      </div>
      <div className="grid gap-4">
        {[0, 1].map((tile) => (
          <ReceiptCard key={tile} className="grid gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="grid min-w-0 flex-1 gap-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-36 max-w-full" />
                <Skeleton className="h-4 w-24 max-w-full" />
              </div>
              <Skeleton className="size-12 shrink-0 rounded-full" />
            </div>
            {/* The tag row HomeCardTile prints above its stamp well. */}
            <div className="flex gap-2">
              <Skeleton className="h-[26px] w-24 rounded-full" />
              <Skeleton className="h-[26px] w-20 rounded-full" />
            </div>
            {/* The `rounded-lg bg-accent p-3` stamp well, not a bare row. */}
            <div className="rounded-lg bg-accent p-3">
              <StampRowSkeleton size="size-10" />
            </div>
            <Skeleton className="h-4 w-full max-w-[16rem]" />
          </ReceiptCard>
        ))}
      </div>
    </div>
  )
}
