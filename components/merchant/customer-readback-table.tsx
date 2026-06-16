"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"

import { ScanIcon } from "@hugeicons/core-free-icons"

import { DataTable, type DataTableColumn } from "@/components/data"
import { Icon } from "@/components/brand"
import { MonoTag } from "@/components/brand"
import { VenueMark } from "@/components/brand"
import { StampGrid } from "@/components/loyalty/stamp-grid"
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

  const selected = selectedId
    ? customers.find((c) => c.id === selectedId)
    : null

  const columns: DataTableColumn<MerchantCustomerReadbackRow>[] = [
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

  return (
    <div className="grid gap-3">
      {selected?.scanRewardId ? (
        <div className="surface-card flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm font-semibold">
            {selected.identifier} has a reward ready to collect.
          </span>
          <Link
            href={`/app/rewards/scan/${selected.scanRewardId}`}
            className="flex items-center gap-1.5 rounded-lg border-2 border-ink bg-primary px-3 py-1.5 font-mono text-[0.7rem] font-bold tracking-[0.06em] text-primary-foreground uppercase shadow-sm transition-[transform,box-shadow] hover:translate-x-px hover:translate-y-px hover:shadow-[1px_1px_0_var(--w-shadow-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            <Icon icon={ScanIcon} size={14} />
            Scan reward
          </Link>
        </div>
      ) : null}

      <DataTable
        caption="Your loyalty members and their stamp progress"
        columns={columns}
        rows={customers}
        getRowKey={(row) => row.id}
        emptyState={emptyState}
        onRowClick={(row) =>
          setSelectedId((prev) => (prev === row.id ? null : row.id))
        }
        rowClassName={(row) =>
          cn(
            row.id === (selectedId ?? highlightedMembershipId)
              ? "bg-primary/10 ring-1 ring-primary/30 ring-inset"
              : undefined
          )
        }
      />

      <p className="px-1 text-xs text-muted-foreground">
        No marketing without a separate opt-in · Exports live with the account
        owner
      </p>
    </div>
  )
}
