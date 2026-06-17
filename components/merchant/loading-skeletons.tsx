import { ReceiptCard } from "@/components/brand"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shared merchant loading skeletons — the single source of truth for every
 * `/app/*` Suspense fallback and the route-level `loading.tsx`. Each skeleton
 * mirrors the *structure* of the surface it stands in for (real shells, real
 * grid breakpoints, ink-tinted lines inside cards) rather than a generic grey
 * blob, so the swap to real content never shifts the layout.
 *
 * Appearance (rounding + ink-tinted fill) is owned once by the Wet Ink
 * `[data-slot="skeleton"]` layer in `app/globals.css`; usages here set only
 * dimensions, layout, and the occasional `rounded-full` for pills and dots.
 */

// ─── Page title ───────────────────────────────────────────────────────────────

/** Mirrors {@link PageTitle}: eyebrow, title, description, and an action slot. */
export function MerchantPageTitleSkeleton() {
  return (
    <section className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
      <div className="grid gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-11 w-32 justify-self-start md:justify-self-end" />
    </section>
  )
}

// ─── Dashboard metrics ─────────────────────────────────────────────────────────

/** Mirrors the dashboard members hero card + five {@link MetricTile} cards. */
export function MerchantDashboardMetricsSkeleton() {
  return (
    <section
      className="grid gap-3"
      role="status"
      aria-label="Loading dashboard metrics"
    >
      <div className="overflow-hidden rounded-lg border-2 border-ink bg-card p-6 shadow-sm">
        <div className="grid content-start gap-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-12 w-28" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4].map((tile) => (
          <div key={tile} className="surface-card grid content-start gap-3 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Compact activity (dashboard) ──────────────────────────────────────────────

/**
 * Mirrors the dashboard {@link ReceiptCard} recent-activity card: a
 * {@link SectionHeader} and three {@link ActivityCompactFeed} rows (badge pill +
 * time + headline + action).
 */
export function MerchantCompactActivitySkeleton() {
  return (
    <ReceiptCard
      className="grid gap-4"
      role="status"
      aria-label="Loading recent activity"
    >
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-9 w-20" />
      </div>

      <ol className="surface-card overflow-hidden p-0 [&>li+li]:border-t-2 [&>li+li]:border-dashed [&>li+li]:border-ink/15">
        {[0, 1, 2].map((row) => (
          <li
            key={row}
            className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
          >
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-4 w-3/5" />
            </div>
            <Skeleton className="h-9 w-24 justify-self-start sm:justify-self-end" />
          </li>
        ))}
      </ol>
    </ReceiptCard>
  )
}

// ─── Activity detail feed ──────────────────────────────────────────────────────

/**
 * Mirrors {@link ActivityDetailFeed}: the search + filter-pill bar, the "shown"
 * line, and two grouped timelines of dot + card rows.
 */
export function ActivityFeedSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading activity">
      <section className="surface-card grid gap-3 p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <Skeleton className="h-9" />
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 5].map((option) => (
              <Skeleton key={option} className="h-8 w-16 rounded-full" />
            ))}
          </div>
        </div>
        <Skeleton className="h-3 w-24" />
      </section>

      <div className="grid gap-6">
        {[0, 1].map((group) => (
          <section key={group} className="grid gap-2">
            <Skeleton className="h-3 w-28" />
            <ol className="grid gap-2">
              {[0, 1, 2].map((row) => (
                <li key={row} className="relative pl-5">
                  <Skeleton className="absolute top-4 left-0 size-2.5 rounded-full" />
                  <Skeleton className="h-[68px]" />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}

// ─── Customers table ───────────────────────────────────────────────────────────

/**
 * Mirrors {@link CustomerReadbackTable}: a header row plus five data rows as a
 * desktop table (`hidden sm:block`) and stacked mobile cards (`sm:hidden`).
 */
export function MerchantCustomersTableSkeleton() {
  const rows = [0, 1, 2, 3, 4]

  return (
    <div
      className="grid gap-3"
      role="status"
      aria-label="Loading loyalty members"
    >
      {/* Mobile: stacked cards */}
      <ul className="grid gap-2.5 sm:hidden">
        {rows.map((row) => (
          <li key={row} className="surface-card grid overflow-hidden">
            <div className="flex items-start gap-2.5 px-3 py-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="grid flex-1 gap-1.5 pt-0.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex items-center justify-between gap-3 border-t-2 border-dashed border-border px-3 pt-2.5 pb-3">
              <Skeleton className="h-4 w-24" />
              <div className="grid justify-items-end gap-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop/tablet: table */}
      <div className="surface-card hidden overflow-hidden sm:block">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b-2 border-ink bg-secondary/60 px-4 py-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
        {rows.map((row) => (
          <div
            key={row}
            className="flex items-center gap-3 border-b border-dashed border-ink/15 px-4 py-3 last:border-b-0"
          >
            <Skeleton className="size-8 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>

      <Skeleton className="mx-1 h-3 w-72 max-w-full" />
    </div>
  )
}

// ─── Launch panels ─────────────────────────────────────────────────────────────

/**
 * Mirrors the active Launch tab body: a form-field stack for the card/venue
 * tabs, or a QR frame + share/print blocks for the qr tab.
 */
export function LaunchPanelSkeleton({ tab }: { tab: "card" | "venue" | "qr" }) {
  if (tab === "qr") {
    return (
      <div className="grid gap-5" role="status" aria-label="Loading launch kit">
        <div className="surface-card grid gap-6 p-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="grid h-fit content-start gap-4">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid content-start gap-5">
            <div className="grid gap-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-56 max-w-full" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-28 w-full" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-11 w-36" />
              <Skeleton className="h-11 w-32" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-5" role="status" aria-label="Loading setup form">
      <div className="surface-card grid gap-4 p-6">
        {[0, 1, 2, 3].map((field) => (
          <div key={field} className="grid gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
        <Skeleton className="h-11 w-40" />
      </div>
    </div>
  )
}

// ─── Account panels ────────────────────────────────────────────────────────────

/**
 * Mirrors {@link ProfilePanel}: the read-only "what customers see" card and the
 * multi-field business form below it.
 */
export function AccountProfilePanelSkeleton() {
  return (
    <section className="grid gap-5" role="status" aria-label="Loading profile">
      <section className="surface-card grid gap-3 p-5">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-7 w-48 max-w-full" />
        <Skeleton className="h-4 w-full max-w-sm" />
        <Skeleton className="h-4 w-32" />
      </section>

      <div className="surface-card grid gap-4 p-6">
        {[0, 1, 2, 3].map((field) => (
          <div key={field} className="grid gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
        <Skeleton className="h-11 w-40" />
      </div>
    </section>
  )
}

/**
 * Mirrors {@link BillingPanel}: the {@link ReceiptCard} with a header, three
 * plan receipt lines, a period note, and the Stripe action row.
 */
export function AccountBillingPanelSkeleton() {
  return (
    <section className="grid gap-4" role="status" aria-label="Loading billing">
      <ReceiptCard edge className="grid gap-5">
        <div className="grid gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>

        <div className="grid gap-0">
          {[0, 1, 2].map((line) => (
            <div
              key={line}
              className="flex items-center justify-between gap-4 border-b border-dashed border-ink/15 py-2.5 last:border-b-0"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>

        <Skeleton className="h-4 w-full max-w-sm" />

        <div className="grid gap-4 border-t-2 border-dashed border-ink/20 pt-5">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-11 w-36" />
            <Skeleton className="h-11 w-40" />
          </div>
          <Skeleton className="h-3 w-full max-w-sm" />
        </div>
      </ReceiptCard>
    </section>
  )
}

// ─── Reward scan ───────────────────────────────────────────────────────────────

/**
 * Mirrors the reward scan body: the {@link RewardTicket} chit, the customer/card
 * detail card, and a status banner + action placeholder.
 */
export function RewardScanContentSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading reward">
      <div className="flex overflow-hidden rounded-[10px] border-2 border-ink bg-card">
        <div className="grid flex-1 content-center gap-2 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-40 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xs" />
        </div>
        <span
          aria-hidden="true"
          className="border-l-2 border-dashed border-ink/50"
        />
        <div className="grid w-[88px] content-center justify-items-center gap-2 p-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border-2 border-ink bg-card p-4">
        {[0, 1].map((line) => (
          <div key={line} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>

      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  )
}
