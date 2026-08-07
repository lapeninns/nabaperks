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
    <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
      <div className="grid gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-11 w-32 justify-self-start md:justify-self-end md:pt-8" />
    </section>
  )
}

// ─── Dashboard QR quick-access ─────────────────────────────────────────────────

/** Mirrors {@link DashboardQrCardView}: the tappable QR ticket (frame +
 *  mono caption) beside the status row, venue title, and action row. */
export function DashboardQrCardSkeleton() {
  return (
    <ReceiptCard
      edge
      className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-6"
    >
      <div className="mx-auto grid w-fit justify-items-center gap-2 sm:mx-0">
        <Skeleton className="aspect-square size-[9.25rem] rounded-lg" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="grid gap-3">
        <div className="grid gap-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-6 w-52 max-w-full" />
        </div>
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-11 w-40" />
          <Skeleton className="h-11 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
    </ReceiptCard>
  )
}

// ─── Dashboard metrics ─────────────────────────────────────────────────────────

/**
 * Mirrors the dashboard body: the four {@link KpiTile} cards (2-up phone, 4-up
 * desktop) with sparkline slots and the Stamps-vs-Joins trend card.
 */
export function MerchantDashboardMetricsSkeleton() {
  return (
    <div
      className="grid gap-6"
      role="status"
      aria-label="Loading dashboard metrics"
    >
      <section className="grid gap-3">
        <div className="grid gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-56 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((tile) => (
            <div
              key={tile}
              className="surface-card grid content-start gap-2 p-4"
            >
              <Skeleton className="h-3 w-20" />
              <div className="flex items-end justify-between gap-3">
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-7 w-16" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>

        <div className="surface-card grid gap-3 p-5">
          <Skeleton className="h-3 w-28" />
          <div className="flex gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-28 w-full sm:h-40" />
        </div>
      </section>
    </div>
  )
}

// ─── Compact activity (dashboard) ──────────────────────────────────────────────

/**
 * Mirrors the dashboard {@link ReceiptCard} recent-activity card: a
 * {@link SectionHeader} and four {@link ActivityCompactFeed} rows (badge pill +
 * time + headline + action) — matching the streamed feed's `{ limit: 4 }` so the
 * fallback height does not shift when real content arrives.
 */
export function MerchantCompactActivitySkeleton() {
  return (
    // Sibling of MerchantDashboardMetricsSkeleton on /app — that skeleton owns
    // the single authoritative `role="status"` announcement, so this fallback is
    // hidden from assistive tech to avoid a duplicate "Loading…" on stream.
    <ReceiptCard className="grid gap-4" aria-hidden="true">
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-9 w-20" />
      </div>

      <ol className="overflow-hidden rounded-lg bg-background/60 p-0 [&>li+li]:border-t-2 [&>li+li]:border-dashed [&>li+li]:border-ink/15">
        {[0, 1, 2, 3].map((row) => (
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
      {/* This-week strip */}
      <section className="grid gap-2">
        <Skeleton className="h-3 w-20" />
        <div className="surface-card grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
          {[0, 1, 2, 3].map((cell) => (
            <div
              key={cell}
              className="grid justify-items-center gap-1.5 bg-card px-2 py-3"
            >
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </section>

      {/* Search + filter pills */}
      <section className="surface-card grid gap-3 p-3 sm:p-4">
        <Skeleton className="h-11 w-full" />
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5].map((option) => (
            <Skeleton key={option} className="h-9 w-16 rounded-full" />
          ))}
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
                  {/* Mirrors the real ActivityDetailCard shape — badge + time
                      line, headline, right-side action slot — not a plain
                      slab, so the swap-in never shifts. */}
                  <div className="grid gap-3 rounded-lg border-2 border-ink/15 bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="grid gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                      <Skeleton className="h-4 w-3/5" />
                    </div>
                    <Skeleton className="h-9 w-24 justify-self-start sm:justify-self-end" />
                  </div>
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
 * desktop table (`hidden lg:block`) and stacked cards (`lg:hidden`) — the real
 * table only mounts from lg (the md sidebar leaves too little width at 768).
 */
export function MerchantCustomersTableSkeleton() {
  const rows = [0, 1, 2, 3, 4]

  return (
    <div
      className="grid gap-4"
      role="status"
      aria-label="Loading loyalty members"
    >
      {/* Summary strip */}
      <div className="surface-card grid grid-cols-3 gap-px overflow-hidden bg-line">
        {[0, 1, 2].map((cell) => (
          <div
            key={cell}
            className="grid justify-items-center gap-1.5 bg-card px-2 py-3"
          >
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>

      {/* Search + filter pills */}
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <Skeleton className="h-11 w-full sm:max-w-xs" />
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((pill) => (
            <Skeleton key={pill} className="h-9 w-16 rounded-full" />
          ))}
        </div>
      </div>

      {/* Phone + tablet: stacked cards (the real card list shows below lg) */}
      <ul className="grid gap-2.5 lg:hidden">
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

      {/* Desktop: table (lg+) — mirrors buildColumns(): Member, Joined,
          Stamps, Last visit, Reward (all columns render at lg+). */}
      <div className="surface-card hidden overflow-hidden lg:block">
        <div className="flex items-center gap-4 border-b-2 border-ink bg-secondary/60 px-4 py-3">
          <Skeleton className="h-3 w-16 flex-1" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14" />
        </div>
        {rows.map((row) => (
          <div
            key={row}
            className="flex items-start gap-4 border-b border-dashed border-ink/15 px-4 py-3 last:border-b-0"
          >
            <span className="flex flex-1 items-center gap-2.5">
              <Skeleton className="size-8 rounded-full" />
              <span className="grid gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </span>
            </span>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
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
 * Mirrors the active Launch tab body. Each branch tracks the real panel layout
 * so a tab switch (the `key={activeTab}` Suspense boundary re-mounts on every
 * switch) does not shift the layout: the card tab is the 2-col form + preview
 * shell, the rewards tab is the counter header + reward rows + dashed add row,
 * the venue tab is a simple form stack, and the qr tab is the QR frame + share
 * controls.
 */
export function LaunchPanelSkeleton({
  tab,
}: {
  tab: "card" | "rewards" | "venue" | "qr"
}) {
  if (tab === "qr") {
    return (
      <div className="grid gap-5" role="status" aria-label="Loading venue QR">
        <div className="surface-card grid gap-6 p-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="grid h-fit content-start gap-3">
            <Skeleton className="aspect-square w-full" />
            {/* Status line ("Live · accepting scans") under the QR frame. */}
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="grid content-start gap-4">
            <div className="grid gap-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-56 max-w-full" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
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

  if (tab === "rewards") {
    return (
      <div
        className="grid gap-5"
        role="status"
        aria-label="Loading reward pool"
      >
        <section className="surface-card grid gap-4 p-3 sm:p-6">
          {/* Header: title block + the live active-count counter tag. */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </div>
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full max-w-md" />
          {/* Variable reward rows. */}
          <div className="grid gap-2">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="grid grid-cols-[auto_1fr_auto] items-start gap-2.5 rounded-lg border-2 border-border p-2.5"
              >
                <Skeleton className="size-8 rounded-full" />
                <div className="grid gap-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full max-w-xs" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
          {/* Dashed "Add a reward" button. */}
          <Skeleton className="h-12 w-full rounded-lg border-2 border-dashed border-ink/25 bg-transparent" />
        </section>
      </div>
    )
  }

  if (tab === "card") {
    return (
      <div
        className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6"
        role="status"
        aria-label="Loading setup form"
      >
        <div className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-3 sm:gap-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="hidden h-4 w-full max-w-sm sm:block" />
            </div>
            <Skeleton className="hidden h-3 w-12 sm:block" />
          </div>
          {[0, 1, 2].map((field) => (
            <div key={field} className="grid gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
          <Skeleton className="h-11 w-full" />
        </div>
        {/* Customer card preview panel (lg sidebar). */}
        <Skeleton className="hidden h-72 w-full lg:block" />
      </div>
    )
  }

  return (
    <div className="grid gap-5" role="status" aria-label="Loading setup form">
      <div className="surface-card grid gap-4 p-3 sm:p-6">
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
          {/* Active/trialing steady state shows a single Stripe action. */}
          <div className="flex flex-wrap gap-2">
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
      <div className="surface-card-flat flex overflow-hidden">
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

      <div className="grid gap-2 rounded-lg border-2 border-ink bg-card p-4">
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

// ─── Offers ────────────────────────────────────────────────────────────────────

/**
 * Mirrors {@link OfferCampaignPanel}: the ink-bordered campaign card (header +
 * status tag, the rules readback, the link row and the manage row) followed by
 * the four-up results tiles, so the swap-in never shifts the manage controls.
 */
export function OfferCampaignPanelSkeleton() {
  return (
    <div className="grid gap-5" role="status" aria-label="Loading your offer">
      <section className="grid gap-5 rounded-lg border-2 border-ink bg-card p-4 shadow-[var(--shadow-hard)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-56 max-w-full" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        {/* Rules readback: label/value rows on a dashed rule. */}
        <div className="grid gap-0">
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between gap-4 border-b border-dashed border-ink/15 py-2.5 last:border-b-0"
            >
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-40 max-w-[50%]" />
            </div>
          ))}
        </div>

        {/* Confidential link + share actions. */}
        <div className="grid gap-3 border-t-2 border-dashed border-ink/20 pt-5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-11 w-32" />
            <Skeleton className="h-11 w-32" />
            <Skeleton className="h-11 w-44" />
          </div>
        </div>

        {/* Manage row. */}
        <div className="grid gap-4 border-t-2 border-dashed border-ink/20 pt-5">
          <Skeleton className="h-3 w-16" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-11 w-40" />
            <Skeleton className="h-11 w-36" />
            <Skeleton className="h-11 w-32" />
          </div>
        </div>
      </section>

      <section className="grid gap-2">
        <Skeleton className="h-3 w-28" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((tile) => (
            <div
              key={tile}
              className="surface-card grid content-start gap-2 p-4"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/**
 * Mirrors the offer pass scan body at app/app/offers/scan/[passToken]: the
 * receipt-card pass face (eyebrow, percentage lockup, validity and terms), the
 * member/card readback, the status banner, and the attestation block plus
 * confirm action the staff member is about to use.
 *
 * This route's `<Suspense fallback>` renders it, so the shapes here and the
 * shapes there must move together.
 */
export function OfferPassScanContentSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading offer pass">
      <div>
        <div className="surface-card-flat grid gap-2 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full max-w-xs" />
        </div>
        <div aria-hidden="true" className="receipt-edge" />
      </div>

      <div className="grid gap-2 rounded-lg border-2 border-ink bg-card p-4">
        {[0, 1].map((line) => (
          <div key={line} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>

      {/* Status banner, then two attestation rows and the confirm action. */}
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-2">
        {[0, 1].map((row) => (
          <Skeleton key={row} className="h-14 w-full" />
        ))}
      </div>
      <Skeleton className="h-11 w-full" />
    </div>
  )
}
