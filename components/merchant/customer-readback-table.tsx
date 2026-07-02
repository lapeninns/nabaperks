"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"

import { ScanIcon, Search01Icon } from "@hugeicons/core-free-icons"

import { DataTable, StatStrip, type DataTableColumn } from "@/components/data"
import { FilterPills, Icon, MonoTag, VenueMark } from "@/components/brand"
import { StampGrid } from "@/components/loyalty/stamp-grid"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  buildCustomersPagination,
  type CustomersPagination,
} from "@/lib/merchant/customers-paging"
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
        isSelected && "bg-primary/10 ring-1 ring-primary/30 ring-inset"
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
          <VenueMark initials={row.initials || "?"} size={36} />
          <span className="grid min-w-0 flex-1 gap-0.5 pt-0.5">
            <span className="truncate text-sm leading-snug font-bold">
              {row.identifier}
            </span>
            {row.phoneLine ? (
              <span className="font-mono text-[0.66rem] font-bold tracking-[0.04em] text-muted-foreground">
                {row.phoneLine}
              </span>
            ) : null}
          </span>
          <MonoTag tone={style.tag} className="mt-0.5 shrink-0">
            {row.badge.label}
          </MonoTag>
        </div>

        {/* Stamp + date metadata row — decorative detail, named by aria-label */}
        <div
          aria-hidden="true"
          className="flex items-start justify-between gap-3 border-t-2 border-dashed border-border px-3 pt-2.5 pb-3"
        >
          {/* showCount reserves the always-readable x/y label above the grid;
              the auto-fit tracks wrap dense cards (e.g. 12 stamps) into extra
              rows instead of compressing coins over the count. */}
          <StampGrid
            current={row.currentStampCount}
            total={row.stampsRequired}
            compact
            showCount
            className="max-w-[8rem]"
          />
          <div className="grid gap-0.5 text-right">
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

      {isSelected && row.badge.redeemable ? (
        <div className="border-t-2 border-ink/15 px-3 py-2.5">
          <Button
            asChild
            size="default"
            className="w-full gap-1.5 font-mono text-[0.7rem] tracking-[0.06em] uppercase"
          >
            <Link href="/app/scan">
              <Icon icon={ScanIcon} size={14} />
              Open scanner
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
            className="flex min-w-0 items-center gap-2.5 outline-none"
            // Deep-link target: the mount effect scrolls + focuses this so an
            // arriving member is brought into view among up to 100 rows. The
            // shared DataTable owns the <tr>, so the marker lives on the cell.
            {...(isHighlighted
              ? { "data-customer-highlight": "true", tabIndex: -1 }
              : {})}
          >
            <VenueMark initials={row.initials || "?"} size={32} />
            <span className="grid min-w-0 gap-0.5">
              <span className="truncate text-sm leading-snug font-bold">
                {row.identifier}
              </span>
              {row.phoneLine ? (
                <span className="font-mono text-[0.66rem] font-bold tracking-[0.04em] text-muted-foreground">
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
      // showCount reserves the readable x/y label above the auto-fit grid, so
      // dense cards wrap into extra coin rows inside the cell instead of
      // compressing over the count (DESIGN.md, Stamps & Grids width pressure).
      cell: (row) => (
        <StampGrid
          current={row.currentStampCount}
          total={row.stampsRequired}
          compact
          showCount
          className="max-w-[8rem]"
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
      cell: (row) => {
        const style = BADGE_STYLES[row.badge.tone]
        return (
          <span className="flex flex-col items-start gap-1.5">
            <MonoTag tone={style.tag}>{row.badge.label}</MonoTag>
            {/* A real focusable control so the scan action is keyboard-reachable
                without relying on the mouse-only row selection (WCAG 2.1.1 /
                4.1.2). Mirrors the inline CTA the mobile card already exposes. */}
            {row.badge.redeemable ? (
              <Button
                asChild
                size="sm"
                className="gap-1.5 font-mono text-[0.65rem] tracking-[0.06em] uppercase [@media(pointer:coarse)]:min-h-11"
              >
                <Link
                  href="/app/scan"
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`Open scanner for ${row.identifier}'s reward QR`}
                >
                  <Icon icon={ScanIcon} size={14} />
                  Scan
                </Link>
              </Button>
            ) : null}
          </span>
        )
      },
    },
  ]
}

// ─── Filtering ────────────────────────────────────────────────────────────────

type CustomerFilter = "all" | "ready" | "active" | "quiet"

/** A member who has visited at least once and is not gone-quiet. */
function isActiveMember(row: MerchantCustomerReadbackRow): boolean {
  return row.lastVisitIso != null && row.badge.tone !== "quiet"
}

function matchesFilter(
  row: MerchantCustomerReadbackRow,
  filter: CustomerFilter
): boolean {
  switch (filter) {
    case "ready":
      return row.badge.tone === "ready"
    case "quiet":
      return row.badge.tone === "quiet"
    case "active":
      return isActiveMember(row)
    default:
      return true
  }
}

function filterCustomers(
  customers: MerchantCustomerReadbackRow[],
  filter: CustomerFilter,
  query: string
): MerchantCustomerReadbackRow[] {
  const needle = query.trim().toLowerCase()
  return customers.filter((row) => {
    if (!matchesFilter(row, filter)) return false
    if (!needle) return true
    return (
      row.identifier.toLowerCase().includes(needle) ||
      (row.phoneLine?.toLowerCase().includes(needle) ?? false)
    )
  })
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function CustomerReadbackTable({
  customers,
  emptyState,
  highlightedMembershipId,
  totalMembers,
  page = 1,
}: {
  customers: MerchantCustomerReadbackRow[]
  emptyState: ReactNode
  highlightedMembershipId?: string
  /**
   * True membership count from a server-side COUNT. The `customers` list is
   * one page of at most CUSTOMERS_PAGE_SIZE rows, so its length understates
   * the real total for large merchants. When provided, the "Members" stat
   * shows this number and drives the pagination; when omitted it falls back
   * to `customers.length`, keeping the prior behaviour for any caller that
   * does not pass it.
   */
  totalMembers?: number
  /** 1-based page the loader used (drives the Prev/Next links). */
  page?: number
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    highlightedMembershipId ?? null
  )
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<CustomerFilter>("all")
  const rootRef = useRef<HTMLDivElement>(null)

  const handleSelect = (id: string) =>
    setSelectedId((prev) => (prev === id ? null : id))

  // One reduce over the immutable customers prop instead of three full-array
  // scans on every keystroke; the summary counts never depend on filter/query.
  const { readyCount, quietCount, activeCount } = useMemo(
    () =>
      customers.reduce(
        (acc, c) => {
          if (c.badge.tone === "ready") acc.readyCount += 1
          if (c.badge.tone === "quiet") acc.quietCount += 1
          if (isActiveMember(c)) acc.activeCount += 1
          return acc
        },
        { readyCount: 0, quietCount: 0, activeCount: 0 }
      ),
    [customers]
  )

  const filtered = useMemo(
    () => filterCustomers(customers, filter, query),
    [customers, filter, query]
  )

  // Resolve the scan banner against the *visible* list so it never lingers for a
  // member the current filter/search has hidden.
  const selected = selectedId ? filtered.find((c) => c.id === selectedId) : null

  const columns = useMemo(
    () => buildColumns(highlightedMembershipId),
    [highlightedMembershipId]
  )

  // Deep-link arrival: bring the highlighted member into view (it can sit below
  // the fold among up to 100 rows) and move focus to it. Runs once per id. Both
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

  const pagination = buildCustomersPagination(
    page,
    totalMembers ?? customers.length
  )
  const totalLabel = (totalMembers ?? customers.length).toLocaleString("en-GB")

  if (customers.length === 0) {
    // Distinguish "no members at all" from "this page is empty" (a stale
    // ?page= link beyond the end): the latter keeps navigation back.
    if ((totalMembers ?? 0) > 0) {
      return (
        <div className="grid gap-3">
          <div className="surface-card px-4 py-10 text-center">
            <p className="text-sm font-semibold">Nothing on this page</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your {totalLabel} members end before page {pagination.page}.
            </p>
          </div>
          <CustomersPaginationRow
            pagination={pagination}
            totalLabel={totalLabel}
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
      <StatStrip
        items={[
          {
            label: "Members",
            // Prefer the true server-side total over the (paged) loaded count
            // so large merchants see their real membership size — formatted
            // with en-GB grouping to match the dashboard KPI ("1,842", not
            // "1842").
            value: totalLabel,
            tone: "ink",
          },
          { label: "Ready", value: readyCount, tone: "primary" },
          { label: "Quiet", value: quietCount, tone: "sun" },
        ]}
      />

      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Icon
            icon={Search01Icon}
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            inputMode="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search members"
            aria-label="Search members"
            className="pl-9"
          />
        </div>
        {/* flex-wrap keeps every pill visible on narrow phones instead of
            clipping mid-pill in the hidden-scrollbar row with no affordance. */}
        <FilterPills
          aria-label="Filter members by reward status"
          value={filter}
          onValueChange={(id) => setFilter(id as CustomerFilter)}
          className="flex-wrap sm:justify-end"
          items={[
            { id: "all", label: "All", count: customers.length },
            { id: "ready", label: "Ready", count: readyCount },
            { id: "active", label: "Active", count: activeCount },
            { id: "quiet", label: "Quiet", count: quietCount },
          ]}
        />
      </div>

      {/* Multi-page honesty: search/filter run client-side over the loaded
          page only, so say so — every member is reachable via the page
          controls below the list. */}
      {pagination.totalPages > 1 ? (
        <p className="px-1 text-xs text-muted-foreground">
          Showing members {pagination.rangeStart}–{pagination.rangeEnd} of{" "}
          {totalLabel}, newest first — search and filters cover this page only.
          Older members are on the later pages.
        </p>
      ) : null}

      {/* Scan-reward banner — table widths only (the card list, shown below
          lg, carries the same CTA inline in the selected card) */}
      {selected?.badge.redeemable ? (
        <div className="surface-card hidden flex-wrap items-center justify-between gap-3 px-4 py-3 lg:flex">
          <span className="min-w-0 text-sm font-semibold">
            {selected.identifier} has a reward ready. Ask them to show their
            reward QR.
          </span>
          <Button
            asChild
            size="sm"
            className="gap-1.5 font-mono text-[0.7rem] tracking-[0.06em] uppercase"
          >
            <Link href="/app/scan">
              <Icon icon={ScanIcon} size={14} />
              Open scanner
            </Link>
          </Button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="surface-card px-4 py-10 text-center">
          <p className="text-sm font-semibold">No members match your filter</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different status or clear the search.
          </p>
        </div>
      ) : (
        <>
          {/* Phone + tablet: card list (hidden at lg and above). The switch
              sits at lg, not sm, because the md sidebar leaves ~510px of
              content at 768 — too narrow for the five-column table, which
              previously forced page-level horizontal overflow (clipped intro,
              cut filter pills, chopped Scan action). This is a bespoke lg
              split; DataTable's shared contract only supports sm and xl. */}
          <div className="lg:hidden">
            <CustomerMobileList
              customers={filtered}
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
              rows={filtered}
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
                    ? "bg-primary/10 ring-1 ring-primary/30 ring-inset"
                    : undefined
                )
              }
            />
          </div>
        </>
      )}

      <CustomersPaginationRow pagination={pagination} totalLabel={totalLabel} />

      <PrivacyNote />
    </div>
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
}: {
  pagination: CustomersPagination
  totalLabel: string
}) {
  if (pagination.totalPages <= 1) return null

  return (
    <nav
      aria-label="Members pages"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <Button
        asChild={pagination.hasPrev}
        variant="secondary"
        size="sm"
        disabled={!pagination.hasPrev}
      >
        {pagination.hasPrev ? (
          <Link href={customersPageHref(pagination.page - 1)} prefetch={false}>
            Previous page
          </Link>
        ) : (
          <span>Previous page</span>
        )}
      </Button>
      <span className="mono-meta numeric-tabular text-muted-foreground">
        Page {pagination.page} of {pagination.totalPages} · {totalLabel} members
      </span>
      <Button
        asChild={pagination.hasNext}
        variant="secondary"
        size="sm"
        disabled={!pagination.hasNext}
      >
        {pagination.hasNext ? (
          <Link href={customersPageHref(pagination.page + 1)} prefetch={false}>
            Next page
          </Link>
        ) : (
          <span>Next page</span>
        )}
      </Button>
    </nav>
  )
}

/** Page 1 keeps a clean URL; later pages carry ?page=N. */
function customersPageHref(page: number) {
  return page <= 1 ? "/app/customers" : `/app/customers?page=${page}`
}

function PrivacyNote() {
  return (
    <p className="px-1 text-xs text-muted-foreground">
      Initials only · phones stay hashed · no marketing without a separate
      opt-in · exports live with the account owner
    </p>
  )
}
