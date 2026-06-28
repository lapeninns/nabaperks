"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"

import { ScanIcon, Search01Icon } from "@hugeicons/core-free-icons"

import { DataTable, StatStrip, type DataTableColumn } from "@/components/data"
import { FilterPills, Icon, MonoTag, VenueMark } from "@/components/brand"
import { StampGrid } from "@/components/loyalty/stamp-grid"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

function CustomerMobileCard({
  row,
  isSelected,
  onSelect,
}: {
  row: MerchantCustomerReadbackRow
  isSelected: boolean
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

        {/* Stamp + date metadata row */}
        <div className="flex items-center justify-between gap-3 border-t-2 border-dashed border-border px-3 pt-2.5 pb-3">
          <div className="flex items-center gap-2">
            <StampGrid
              current={row.currentStampCount}
              total={row.stampsRequired}
              compact
              className="max-w-[6rem]"
            />
            <span className="numeric-tabular text-xs font-bold text-muted-foreground">
              {row.currentStampCount}/{row.stampsRequired}
            </span>
          </div>
          <div className="grid gap-0.5 text-right">
            <time
              className="font-mono text-[0.6rem] font-bold tracking-[0.04em] text-muted-foreground uppercase"
              dateTime={row.joinedIso}
            >
              Joined: {row.joinedLabel}
            </time>
            {row.lastVisitIso ? (
              <time
                className="font-mono text-[0.6rem] font-bold tracking-[0.04em] text-muted-foreground uppercase"
                dateTime={row.lastVisitIso}
              >
                Last: {row.lastVisitLabel}
              </time>
            ) : (
              <span className="font-mono text-[0.6rem] font-bold tracking-[0.04em] text-muted-foreground uppercase">
                Last: {row.lastVisitLabel}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Scan action — sibling of <button> to avoid <a> inside <button> */}
      {isSelected && row.scanRewardId ? (
        <div className="border-t-2 border-ink/15 px-3 py-2.5">
          <Button
            asChild
            size="default"
            className="w-full gap-1.5 font-mono text-[0.7rem] tracking-[0.06em] uppercase"
          >
            <Link href={`/app/rewards/scan/${row.scanRewardId}`}>
              <Icon icon={ScanIcon} size={14} />
              Scan reward
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
  onSelect,
}: {
  customers: MerchantCustomerReadbackRow[]
  selectedId: string | null
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
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  )
}

// ─── Table columns ────────────────────────────────────────────────────────────

function buildColumns(): DataTableColumn<MerchantCustomerReadbackRow>[] {
  return [
    {
      key: "member",
      header: "Member",
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2.5">
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
      ),
    },
    {
      key: "joined",
      header: "Joined",
      // Hidden below lg — at sm/md the card list or compact table covers this
      className: "hidden lg:table-cell",
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
      cell: (row) => (
        <span className="flex items-center gap-2">
          <StampGrid
            current={row.currentStampCount}
            total={row.stampsRequired}
            compact
            className="max-w-[8rem]"
          />
          <span className="numeric-tabular text-xs font-bold text-muted-foreground">
            {row.currentStampCount}/{row.stampsRequired}
          </span>
        </span>
      ),
    },
    {
      key: "lastVisit",
      header: "Last visit",
      // Hidden below md — shown from md (768px) upwards
      className: "hidden md:table-cell",
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
        return <MonoTag tone={style.tag}>{row.badge.label}</MonoTag>
      },
    },
  ]
}

const TABLE_COLUMNS = buildColumns()

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
}: {
  customers: MerchantCustomerReadbackRow[]
  emptyState: ReactNode
  highlightedMembershipId?: string
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    highlightedMembershipId ?? null
  )
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<CustomerFilter>("all")

  const selected = selectedId
    ? customers.find((c) => c.id === selectedId)
    : null

  const handleSelect = (id: string) =>
    setSelectedId((prev) => (prev === id ? null : id))

  const readyCount = customers.filter((c) => c.badge.tone === "ready").length
  const quietCount = customers.filter((c) => c.badge.tone === "quiet").length
  const activeCount = customers.filter(isActiveMember).length

  const filtered = useMemo(
    () => filterCustomers(customers, filter, query),
    [customers, filter, query]
  )

  if (customers.length === 0) {
    return (
      <div className="grid gap-3">
        {emptyState}
        <PrivacyNote />
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <StatStrip
        items={[
          { label: "Members", value: customers.length, tone: "ink" },
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
        <FilterPills
          aria-label="Filter members by reward status"
          value={filter}
          onValueChange={(id) => setFilter(id as CustomerFilter)}
          className="sm:justify-end"
          items={[
            { id: "all", label: "All", count: customers.length },
            { id: "ready", label: "Ready", count: readyCount },
            { id: "active", label: "Active", count: activeCount },
            { id: "quiet", label: "Quiet", count: quietCount },
          ]}
        />
      </div>

      {/* Scan-reward banner — desktop only (mobile has it inline in the card) */}
      {selected?.scanRewardId ? (
        <div className="surface-card hidden items-center justify-between gap-4 px-4 py-3 sm:flex">
          <span className="text-sm font-semibold">
            {selected.identifier} has a reward ready to collect.
          </span>
          <Button
            asChild
            size="sm"
            className="gap-1.5 font-mono text-[0.7rem] tracking-[0.06em] uppercase"
          >
            <Link href={`/app/rewards/scan/${selected.scanRewardId}`}>
              <Icon icon={ScanIcon} size={14} />
              Scan reward
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
          {/* Mobile: card list (hidden at sm and above) */}
          <div className="sm:hidden">
            <CustomerMobileList
              customers={filtered}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>

          {/* Desktop/tablet: table (hidden below sm) */}
          <div className="hidden sm:block">
            <DataTable
              caption="Your loyalty members and their stamp progress"
              columns={TABLE_COLUMNS}
              rows={filtered}
              getRowKey={(row) => row.id}
              emptyState={emptyState}
              onRowClick={(row) => handleSelect(row.id)}
              rowClassName={(row) =>
                cn(
                  row.id === (selectedId ?? highlightedMembershipId)
                    ? "bg-primary/10 ring-1 ring-primary/30 ring-inset"
                    : undefined
                )
              }
            />
          </div>
        </>
      )}

      <PrivacyNote />
    </div>
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
