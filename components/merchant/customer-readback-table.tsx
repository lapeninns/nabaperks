"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  ScanIcon,
  Search01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import {
  ConsoleFilterBar,
  DataTable,
  type DataTableColumn,
} from "@/components/data"
import { EmptyState, Icon, MemberMark, MonoTag } from "@/components/brand"
import { StampGrid } from "@/components/loyalty/stamp-grid"
import { Button } from "@/components/ui/button"
import {
  buildCustomersPagination,
  type CustomersPagination,
} from "@/lib/merchant/customers-paging"
import {
  buildCustomersHref,
  CUSTOMER_MATCH_ID_CAP,
  type CustomerFilter,
} from "@/lib/merchant/customers-filter"
import { formatMerchantCustomerIdentifier } from "@/lib/merchant/customer-identity-display"
import type {
  MerchantCustomerReadbackRow,
  MerchantCustomerRewardTone,
} from "@/lib/merchant/customer-readback"
import { cn } from "@/lib/utils"

export { formatMerchantCustomerIdentifier }

type BadgeToneStyle = {
  tag: Parameters<typeof MonoTag>[0]["tone"]
}

const BADGE_STYLES: Record<MerchantCustomerRewardTone, BadgeToneStyle> = {
  ready: { tag: "accent" },
  waiting: { tag: "sun" },
  new: { tag: "ink" },
  quiet: { tag: "plain" },
  redeemed: { tag: "plain" },
  collecting: { tag: "plain" },
}

// ─── Mobile card ──────────────────────────────────────────────────────────────

/**
 * Concise accessible name for the mobile card toggle. Without this the computed
 * name swallows the whole stamp grid (a nested role="list") plus both dates into
 * one long run-on. WCAG 4.1.2 / 2.4.6.
 */
function describeMobileCard(row: MerchantCustomerReadbackRow): string {
  return `${row.identifier}, ${row.badge.label}, ${row.currentStampCount} of ${row.stampsRequired} stamps`
}

function CustomerMobileCard({
  row,
  isSelected,
  isHighlighted,
  onSelect,
}: {
  row: MerchantCustomerReadbackRow
  isSelected: boolean
  isHighlighted: boolean
  onSelect: (id: string) => void
}) {
  const style = BADGE_STYLES[row.badge.tone]

  return (
    <div
      className={cn(
        "surface-card grid overflow-hidden transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
        // Selection is an ink decision, not a ring: a 1px ring at 30% alpha over
        // a 10% vermillion wash cannot clear 3:1 non-text contrast, and
        // per-component ring alphas are exactly what DESIGN.md bans. The card's
        // own 2px border switches to the accent instead.
        isSelected && "border-primary bg-secondary"
      )}
    >
      {/* Clickable card body */}
      <button
        type="button"
        onClick={() => onSelect(row.id)}
        aria-pressed={isSelected}
        // A concise, explicit name keeps the accessible name from becoming a
        // run-on of the stamp grid + dates (the visual detail below is
        // aria-hidden). WCAG 4.1.2 / 2.4.6.
        aria-label={describeMobileCard(row)}
        {...(isHighlighted ? { "data-customer-highlight": "true" } : {})}
        className="grid gap-0 text-left"
      >
        {/* Identity row: avatar + identifier + badge */}
        <div className="flex min-w-0 items-start gap-2.5 px-3 py-3">
          <MemberMark
            initials={row.initials || "?"}
            tone={row.badge.tone}
            size={36}
          />
          <span className="grid min-w-0 flex-1 gap-0.5 pt-0.5">
            <span className="truncate text-sm leading-snug font-bold">
              {row.identifier}
            </span>
            {row.phoneLine ? (
              <span className="mono-id text-muted-foreground">
                {row.phoneLine}
              </span>
            ) : null}
          </span>
          <MonoTag tone={style.tag} className="mt-0.5 shrink-0">
            {row.badge.label}
          </MonoTag>
        </div>

        {/* Stamp + date metadata — full-width stamp row, dates below */}
        <div
          aria-hidden="true"
          className="grid gap-2.5 border-t-2 border-dashed border-border px-3 pt-2.5 pb-3"
        >
          <StampGrid
            current={row.currentStampCount}
            total={row.stampsRequired}
            compact
            showCount
            flow="horizontal"
            countPlacement="inline"
            className="min-w-0"
          />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <time
              className="mono-id text-muted-foreground"
              dateTime={row.joinedIso}
            >
              Joined: {row.joinedLabel}
            </time>
            {row.lastVisitIso ? (
              <time
                className="mono-id text-muted-foreground"
                dateTime={row.lastVisitIso}
              >
                Last: {row.lastVisitLabel}
              </time>
            ) : (
              <span className="mono-id text-muted-foreground">
                Last: {row.lastVisitLabel}
              </span>
            )}
          </div>
        </div>
      </button>

      {isSelected ? (
        <div className="grid gap-2 border-t-2 border-ink/15 px-3 py-2.5">
          {row.badge.redeemable ? (
            <Button asChild size="default" className="mono-meta w-full gap-1.5">
              <Link href="/app/scan">
                <Icon icon={ScanIcon} size={14} />
                Open scanner
              </Link>
            </Button>
          ) : null}
          <Button asChild size="default" variant="secondary" className="w-full">
            <Link
              href={`/app/customers/send-reward?member=${encodeURIComponent(row.id)}&label=${encodeURIComponent(row.identifier)}`}
            >
              Send reward
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

// ─── Mobile list ──────────────────────────────────────────────────────────────

function CustomerMobileList({
  customers,
  selectedId,
  highlightedMembershipId,
  onSelect,
}: {
  customers: MerchantCustomerReadbackRow[]
  selectedId: string | null
  highlightedMembershipId?: string
  onSelect: (id: string) => void
}) {
  if (!customers.length) return null

  return (
    <ul className="grid gap-2.5" aria-label="Loyalty members">
      {customers.map((row) => (
        <li key={row.id}>
          <CustomerMobileCard
            row={row}
            isSelected={row.id === selectedId}
            isHighlighted={row.id === highlightedMembershipId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  )
}

// ─── Table columns ────────────────────────────────────────────────────────────

function buildColumns(
  highlightedMembershipId?: string
): DataTableColumn<MerchantCustomerReadbackRow>[] {
  return [
    {
      key: "member",
      header: "Member",
      cell: (row) => {
        const isHighlighted = row.id === highlightedMembershipId
        return (
          <span
            className="focus-ring flex min-w-0 items-center gap-2.5 rounded-sm"
            // Deep-link target: the mount effect scrolls + focuses this so an
            // arriving member is brought into view on the loaded page. The
            // shared DataTable owns the <tr>, so the marker lives on the cell.
            {...(isHighlighted
              ? { "data-customer-highlight": "true", tabIndex: -1 }
              : {})}
          >
            <MemberMark
              initials={row.initials || "?"}
              tone={row.badge.tone}
              size={32}
            />
            <span className="grid min-w-0 gap-0.5">
              <span className="truncate text-sm leading-snug font-bold">
                {row.identifier}
              </span>
              {row.phoneLine ? (
                <span className="mono-id text-muted-foreground">
                  {row.phoneLine}
                </span>
              ) : null}
            </span>
          </span>
        )
      },
    },
    {
      key: "joined",
      header: "Joined",
      // No responsive hiding needed: the table renderer itself only mounts at
      // lg and above (cards cover sm/md), so every column always fits its
      // renderer.
      cell: (row) => (
        <time
          className="text-sm text-muted-foreground"
          dateTime={row.joinedIso}
        >
          {row.joinedLabel}
        </time>
      ),
    },
    {
      key: "stamps",
      header: "Stamps",
      className: "whitespace-normal align-middle",
      cell: (row) => (
        <StampGrid
          current={row.currentStampCount}
          total={row.stampsRequired}
          compact
          showCount
          flow="horizontal"
          countPlacement="inline"
        />
      ),
    },
    {
      key: "lastVisit",
      header: "Last visit",
      cell: (row) =>
        row.lastVisitIso ? (
          <time
            className="text-sm text-muted-foreground"
            dateTime={row.lastVisitIso}
          >
            {row.lastVisitLabel}
          </time>
        ) : (
          <span className="text-sm text-muted-foreground">Not yet</span>
        ),
    },
    {
      key: "reward",
      header: "Reward",
      // The tag alone. This cell used to stack the tag, a conditional Scan
      // button and an always-present Send button — ~128px per redeemable row,
      // and 100 competing CTAs on a full page, none of which is the row's
      // actual primary action. Both actions now live in the selected-member
      // bar above the table, which is keyboard-reachable the moment a row is
      // activated (the row is a real Enter/Space control) and mirrors what the
      // card renderer already did on phones.
      cell: (row) => (
        <MonoTag tone={BADGE_STYLES[row.badge.tone].tag}>
          {row.badge.label}
        </MonoTag>
      ),
    },
  ]
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function CustomerReadbackTable({
  customers,
  emptyState,
  highlightedMembershipId,
  totalMembers,
  matchedMembers,
  counts,
  filter = "all",
  query = "",
  capped = false,
  page = 1,
  basePath,
}: {
  /** One page of the ACTIVE filter + search, already narrowed server-side. */
  customers: MerchantCustomerReadbackRow[]
  emptyState: ReactNode
  highlightedMembershipId?: string
  /**
   * True membership count from a server-side COUNT, ignoring filter and
   * search. When omitted it falls back to `customers.length`, keeping the
   * prior behaviour for any caller that does not pass it (the DB-free
   * harness).
   */
  totalMembers?: number
  /** Members the active filter + search select across every page. */
  matchedMembers?: number
  /** Per-pill totals across every page, not just this one. */
  counts?: Partial<Record<CustomerFilter, number>>
  /** Active `?filter=`. */
  filter?: CustomerFilter
  /** Active `?q=`. */
  query?: string
  /** A match set hit CUSTOMER_MATCH_ID_CAP, so this list is the newest N. */
  capped?: boolean
  /** 1-based page the loader used (drives the Prev/Next links). */
  page?: number
  /**
   * Route every control links to. Only the /dev harness passes it: the real
   * component is mounted there, so without it a pill click would navigate out
   * of the harness into the auth-gated console route.
   */
  basePath?: string
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(
    highlightedMembershipId ?? null
  )
  // Local echo of the URL's `q` so typing stays at input speed; the URL write
  // is debounced below, exactly as the activity feed does it.
  const [draftQuery, setDraftQuery] = useState(query)
  const [syncedQuery, setSyncedQuery] = useState(query)
  const urlWriteTimer = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Adjust during render rather than in an effect: the search input keeps
  // focus across the server round-trip (this component is not remounted for a
  // narrowing change), so a Back navigation that rewrites `?q=` has to reach
  // the field without a second render pass.
  if (syncedQuery !== query) {
    setSyncedQuery(query)
    setDraftQuery(query)
  }

  useEffect(
    () => () => {
      if (urlWriteTimer.current !== null) {
        window.clearTimeout(urlWriteTimer.current)
      }
    },
    []
  )

  const handleSelect = (id: string) =>
    setSelectedId((prev) => (prev === id ? null : id))

  function navigate(next: { filter: CustomerFilter; query: string }) {
    // Any change to the narrowing restarts at page 1: page 4 of the old
    // result set names nothing in the new one.
    router.replace(
      buildCustomersHref({
        filter: next.filter,
        query: next.query,
        basePath,
      }),
      { scroll: false }
    )
  }

  function cancelPendingUrlWrite() {
    if (urlWriteTimer.current === null) return
    window.clearTimeout(urlWriteTimer.current)
    urlWriteTimer.current = null
  }

  function scheduleQueryUrlWrite(nextQuery: string) {
    cancelPendingUrlWrite()
    urlWriteTimer.current = window.setTimeout(() => {
      urlWriteTimer.current = null
      navigate({ filter, query: nextQuery })
    }, 300)
  }

  const resolvedCounts = counts ?? {}
  const selected = selectedId
    ? (customers.find((c) => c.id === selectedId) ?? null)
    : null

  const columns = useMemo(
    () => buildColumns(highlightedMembershipId),
    [highlightedMembershipId]
  )

  // Deep-link arrival: bring the highlighted member into view (it can sit below
  // the fold on a long page) and move focus to it. Runs once per id. Both
  // the mobile card and the desktop table carry the marker, only one of which is
  // visible at a time, so target the one that is actually rendered (the hidden
  // renderer has a null offsetParent under `display:none`).
  useEffect(() => {
    if (!highlightedMembershipId) return
    const markers = rootRef.current?.querySelectorAll<HTMLElement>(
      '[data-customer-highlight="true"]'
    )
    const target = markers
      ? Array.from(markers).find((el) => el.offsetParent !== null)
      : undefined
    if (!target) return
    target.scrollIntoView({ block: "center" })
    target.focus({ preventScroll: true })
  }, [highlightedMembershipId])

  const total = totalMembers ?? customers.length
  const narrowed = filter !== "all" || query.length > 0
  // Pagination follows the ACTIVE result set, not the venue total: page 4 of
  // "all members" names nothing once a search has narrowed the list to six.
  const matched = matchedMembers ?? (narrowed ? customers.length : total)
  const pagination = buildCustomersPagination(page, matched)
  const totalLabel = total.toLocaleString("en-GB")
  const matchedLabel = matched.toLocaleString("en-GB")

  if (customers.length === 0) {
    // Three different zero states, three different recoveries: the venue has no
    // members at all; a filter/search matched nobody; or a stale ?page= link
    // points past the end of a real result set.
    if (narrowed) {
      return (
        <div className="grid gap-3">
          <NarrowingControls
            filter={filter}
            draftQuery={draftQuery}
            counts={resolvedCounts}
            total={total}
            onQueryChange={(next) => {
              setDraftQuery(next)
              scheduleQueryUrlWrite(next)
            }}
            onFilterChange={(next) => {
              cancelPendingUrlWrite()
              navigate({ filter: next, query: draftQuery })
            }}
          />
          <EmptyState
            headingLevel={3}
            icon={Search01Icon}
            title="No members match"
            description={
              query
                ? `Nothing in your ${totalLabel} members matches "${query}". Members are searchable by the masked email or the last four phone digits you can see.`
                : `None of your ${totalLabel} members are in this status right now.`
            }
            actions={
              <Button asChild variant="secondary">
                <Link href={buildCustomersHref({ basePath })}>Clear filters</Link>
              </Button>
            }
          />
          <PrivacyNote />
        </div>
      )
    }

    if (matched > 0) {
      return (
        <div className="grid gap-3">
          <EmptyState
            headingLevel={3}
            icon={UserMultiple02Icon}
            title="Nothing on this page"
            description={`Your ${totalLabel} members end before page ${pagination.page}.`}
            actions={
              <Button asChild variant="secondary">
                <Link href={buildCustomersHref({ basePath })}>Back to page 1</Link>
              </Button>
            }
          />
          <CustomersPaginationRow
            pagination={pagination}
            totalLabel={totalLabel}
            filter={filter}
            query={query}
            basePath={basePath}
          />
          <PrivacyNote />
        </div>
      )
    }

    return (
      <div className="grid gap-3">
        {emptyState}
        <PrivacyNote />
      </div>
    )
  }

  return (
    // min-w-0 keeps the table's intrinsic width from propagating up the grid
    // chain: at worst the ui Table's own overflow-x-auto container scrolls,
    // and the page (intro, filter pills) never overflows the viewport.
    <div className="grid min-w-0 gap-4" ref={rootRef}>
      {/* The StatStrip that used to sit here read Members / Ready / Quiet —
          two thirds of which the filter pills below already show as counts,
          for ~90px on the screen a merchant opens to find one person. The
          only number it owned alone was the true server-side total, which now
          leads the readback line under the controls. No count was dropped. */}
      <NarrowingControls
        filter={filter}
        draftQuery={draftQuery}
        counts={resolvedCounts}
        total={total}
        onQueryChange={(next) => {
          setDraftQuery(next)
          scheduleQueryUrlWrite(next)
        }}
        onFilterChange={(next) => {
          // A pill click writes immediately; cancel any debounced query write
          // so it cannot land afterwards with the previous filter captured.
          cancelPendingUrlWrite()
          navigate({ filter: next, query: draftQuery })
        }}
      />

      {/* One readback line. What it replaced was an apology — the list warned
          that search and the status pills reached the loaded page and no
          further, which was true: both ran in the browser over one 15-row
          window. Both now run in the database across every page (03#18), so
          the line states the real scope instead of excusing it. */}
      <p className="mono-meta px-1 text-muted-foreground">
        {narrowed ? (
          <>
            {matchedLabel} of {totalLabel} members match
            {pagination.totalPages > 1 ? (
              <>
                {" "}
                · showing {pagination.rangeStart}–{pagination.rangeEnd}
              </>
            ) : null}
            , newest first
            {capped ? (
              <> · only the newest {CUSTOMER_MATCH_ID_CAP} matches are listed</>
            ) : null}
          </>
        ) : pagination.totalPages > 1 ? (
          <>
            {totalLabel} members · showing {pagination.rangeStart}–
            {pagination.rangeEnd}, newest first
          </>
        ) : (
          <>{totalLabel} members, newest first</>
        )}
      </p>

      {/* Selected-member action bar — table widths only (the card list, shown
          below lg, carries the same actions inline in the selected card). It
          renders for ANY selected row, not just a redeemable one, because it is
          now the only place the desktop table offers Send; Scan is added on top
          when there is a reward waiting. */}
      {selected ? (
        <div className="surface-card hidden flex-wrap items-center justify-between gap-3 px-4 py-3 lg:flex">
          <span className="min-w-0 text-sm font-semibold">
            {selected.badge.redeemable
              ? `${selected.identifier} has a reward ready. Ask them to show their reward QR.`
              : `${selected.identifier} — ${selected.currentStampCount} of ${selected.stampsRequired} stamps.`}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {selected.badge.redeemable ? (
              <Button asChild size="sm" className="mono-meta gap-1.5">
                <Link href="/app/scan">
                  <Icon icon={ScanIcon} size={14} />
                  Open scanner
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="secondary">
              <Link
                href={`/app/customers/send-reward?member=${encodeURIComponent(selected.id)}&label=${encodeURIComponent(selected.identifier)}`}
                aria-label={`Send a reward to ${selected.identifier}`}
              >
                Send reward
              </Link>
            </Button>
          </span>
        </div>
      ) : null}

      {/* Phone + tablet: card list (hidden at lg and above). The switch
          sits at lg, not sm, because the md sidebar leaves ~510px of content
          at 768 — too narrow for the five-column table, which previously
          forced page-level horizontal overflow (clipped intro, cut filter
          pills, chopped Scan action). This is a bespoke lg split;
          DataTable's shared contract only supports sm and xl. */}
      <div className="lg:hidden">
        <CustomerMobileList
          customers={customers}
          selectedId={selectedId}
          highlightedMembershipId={highlightedMembershipId}
          onSelect={handleSelect}
        />
      </div>

      {/* Desktop: table (hidden below lg) */}
      <div className="hidden min-w-0 lg:block">
        <DataTable
              caption="Your loyalty members and their stamp progress"
              columns={columns}
              rows={customers}
              getRowKey={(row) => row.id}
              emptyState={emptyState}
              onRowClick={(row) => handleSelect(row.id)}
              // Make the clickable row a real keyboard control: focusable, and
              // Enter/Space toggles the same selection the mouse does (WCAG
              // 2.1.1), with selection state announced via aria-selected (WCAG
              // 4.1.2). `aria-selected` is valid on the row's implicit
              // role="row", so we deliberately do NOT set role="button" (that
              // would override the row role and make aria-selected invalid).
              getRowProps={(row) => ({
                tabIndex: 0,
                "aria-selected": row.id === selectedId,
                onKeyDown: (event) => {
                  // Ignore keys bubbling up from inner controls (the Scan
                  // link) so activating it never also toggles the row.
                  if (event.target !== event.currentTarget) return
                  if (event.key === "Enter" || event.key === " ") {
                    // Space would otherwise scroll the page.
                    event.preventDefault()
                    handleSelect(row.id)
                  }
                },
              })}
              rowClassName={(row) =>
                cn(
                  // No highlightedMembershipId fallback — it is already seeded
                  // into selectedId, and the fallback re-selected the deep-linked
                  // row after the user toggled it off.
                  row.id === selectedId
                    ? "bg-secondary [&>td:first-child]:border-l-4 [&>td:first-child]:border-primary"
                    : undefined
                )
              }
        />
      </div>

      <CustomersPaginationRow
        pagination={pagination}
        totalLabel={narrowed ? matchedLabel : totalLabel}
        filter={filter}
        query={query}
        basePath={basePath}
      />

      <PrivacyNote />
    </div>
  )
}

/**
 * Search + status pills, rendered identically above a populated list and above
 * a "no members match" state — the controls that caused the empty result have
 * to stay reachable, or the only recovery is the browser back button.
 *
 * Counts are server totals for the whole venue, not for the loaded page, so a
 * pill that reads "Ready 4" leads to four members however deep they sit.
 */
function NarrowingControls({
  filter,
  draftQuery,
  counts,
  total,
  onQueryChange,
  onFilterChange,
}: {
  filter: CustomerFilter
  draftQuery: string
  counts: Partial<Record<CustomerFilter, number>>
  total: number
  onQueryChange: (next: string) => void
  onFilterChange: (next: CustomerFilter) => void
}) {
  return (
    <ConsoleFilterBar
      layout="inline"
      query={draftQuery}
      onQueryChange={onQueryChange}
      searchPlaceholder="Search members"
      searchLabel="Search members by masked email or last four digits"
      filterLabel="Filter members by reward status"
      filterValue={filter}
      onFilterChange={(id) => onFilterChange(id as CustomerFilter)}
      items={[
        { id: "all", label: "All", count: counts.all ?? total },
        { id: "ready", label: "Ready", count: counts.ready },
        { id: "active", label: "Active", count: counts.active },
        { id: "quiet", label: "Quiet", count: counts.quiet },
      ]}
    />
  )
}

/**
 * Prev/Next page links (URL-driven so back/refresh/deep links work) with a
 * mono "Page X of Y" readback. Renders nothing for a single page, so callers
 * without paging (e.g. the DB-free harness) are unchanged.
 */
function CustomersPaginationRow({
  pagination,
  totalLabel,
  filter = "all",
  query = "",
  basePath,
}: {
  pagination: CustomersPagination
  totalLabel: string
  /** Carried into every page href so paging never drops the narrowing. */
  filter?: CustomerFilter
  query?: string
  basePath?: string
}) {
  if (pagination.totalPages <= 1) return null

  const pageHref = (page: number) =>
    buildCustomersHref({ page, filter, query, basePath })

  return (
    <nav
      aria-label="Members pages"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      {/* At a boundary the control renders as a real disabled <button> with
          plain text children and aria-disabled, not an `asChild` <span>: the
          old shape left a visible element out of the tab order with no state
          for a screen reader to announce, so a keyboard user simply lost it.
          First/Last are here because prev/next alone made the oldest members of
          a large venue an unbounded number of taps away. */}
      <span className="flex flex-wrap items-center gap-2">
        <PageStepButton
          href={pageHref(1)}
          enabled={pagination.hasPrev}
          label="First"
          boundaryHint="you are on the first page"
        />
        <PageStepButton
          href={pageHref(pagination.page - 1)}
          enabled={pagination.hasPrev}
          label="Previous page"
          boundaryHint="you are on the first page"
        />
      </span>
      <span className="mono-meta numeric-tabular text-muted-foreground">
        Page {pagination.page} of {pagination.totalPages} · {totalLabel} members
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <PageStepButton
          href={pageHref(pagination.page + 1)}
          enabled={pagination.hasNext}
          label="Next page"
          boundaryHint="you are on the last page"
        />
        <PageStepButton
          href={pageHref(pagination.totalPages)}
          enabled={pagination.hasNext}
          label="Last"
          boundaryHint="you are on the last page"
        />
      </span>
    </nav>
  )
}

function PageStepButton({
  href,
  enabled,
  label,
  boundaryHint,
}: {
  href: string
  enabled: boolean
  label: string
  boundaryHint: string
}) {
  if (!enabled) {
    return (
      <Button variant="secondary" size="sm" disabled aria-disabled="true">
        {label}
        <span className="sr-only">, {boundaryHint}</span>
      </Button>
    )
  }

  return (
    <Button asChild variant="secondary" size="sm">
      <Link href={href} prefetch={false}>
        {label}
      </Link>
    </Button>
  )
}

function PrivacyNote() {
  return (
    <p className="px-1 text-xs text-muted-foreground">
      Initials only · phones stay hashed · no marketing without a separate
      opt-in · exports live with the account owner
    </p>
  )
}
