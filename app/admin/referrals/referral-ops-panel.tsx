import { UserGroupIcon } from "@hugeicons/core-free-icons"

import { AdminRecordCard } from "@/components/admin/record-card"
import {
  AdminEmptyState,
  AdminPanel,
  SourceLabel,
  StatusPill,
  formatAdminAuditDate,
  maskAdminContact,
} from "@/components/admin/support"
import { SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import type { AdminReferralOpsRow } from "@/lib/admin/data"

/**
 * Support operational referral view (referral ops visibility). Internal-admin
 * detail: referrer → referred, lifecycle state + hold reason, the attribution /
 * qualification / award timeline, and retry/fraud-flag counts. Read-only.
 */
/**
 * The happy path has to be visible: an awarded or qualified referral used to
 * render as the same neutral grey as "pending", so an operator could not see
 * at a glance whether settlement was working.
 */
function statusTone(status: string): "neutral" | "good" | "warning" | "danger" {
  if (status === "awarded" || status === "qualified") return "good"
  if (status === "held") return "warning"
  if (status === "rejected" || status === "cancelled" || status === "expired") {
    return "danger"
  }
  return "neutral"
}

export function ReferralOpsPanel({
  rows,
}: {
  readonly rows: readonly AdminReferralOpsRow[]
}) {
  return (
    <AdminPanel>
      <SectionHeader
        title="Referral records"
        description="Referrer and referred member, current state and hold reason, timeline, and retry/fraud signals."
        actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
      />
      <DataTable
        caption="Admin referral ops readback"
        cardBreakpoint="xl"
        className="rounded-lg shadow-none"
        rows={rows as AdminReferralOpsRow[]}
        getRowKey={(row) => row.referralId}
        emptyState={
          <AdminEmptyState
            icon={UserGroupIcon}
            title="No referrals yet"
            padded={false}
          />
        }
        columns={[
          {
            key: "venue",
            header: "Venue",
            cell: (row) => (
              <span className="font-bold">{row.venueName ?? "—"}</span>
            ),
          },
          {
            key: "people",
            header: "Referrer → referred",
            cell: (row) => (
              // Identity is not metadata: the row reads at the console's
              // small size, with text-xs/.mono-meta reserved for the timeline
              // and counters.
              <div className="grid min-w-40 gap-1 text-sm leading-5">
                {/* Masked like every other admin surface: raw customer
                    email must not render in the console. */}
                <span
                  className="text-foreground"
                  title={
                    row.referrerEmail ? "Referrer contact (masked)" : undefined
                  }
                >
                  {row.referrerEmail
                    ? maskAdminContact(row.referrerEmail)
                    : "—"}
                </span>
                <span className="text-muted-foreground">
                  →{" "}
                  {row.referredEmail
                    ? maskAdminContact(row.referredEmail)
                    : "—"}
                </span>
              </div>
            ),
          },
          {
            key: "state",
            header: "State",
            cell: (row) => (
              <div className="grid gap-1">
                <StatusPill tone={statusTone(row.status)}>
                  {row.status}
                </StatusPill>
                {row.holdReason ? (
                  <span className="text-sm text-muted-foreground">
                    {row.holdReason.replaceAll("_", " ")}
                  </span>
                ) : null}
              </div>
            ),
          },
          {
            key: "timeline",
            header: "Timeline",
            cell: (row) => (
              <div className="mono-meta grid gap-1 leading-5 text-muted-foreground">
                <span>
                  attributed{" "}
                  {row.attributedAt
                    ? formatAdminAuditDate(row.attributedAt)
                    : "—"}
                </span>
                <span>
                  qualified{" "}
                  {row.qualifiedAt
                    ? formatAdminAuditDate(row.qualifiedAt)
                    : "—"}
                </span>
                <span>
                  awarded{" "}
                  {row.bonusAwardedAt
                    ? formatAdminAuditDate(row.bonusAwardedAt)
                    : "—"}
                </span>
              </div>
            ),
          },
          {
            key: "signals",
            header: "Retries / flags",
            cell: (row) => (
              <span className="numeric-tabular text-sm">
                retries {row.retryCount} · flags {row.fraudFlagCount}
              </span>
            ),
          },
        ]}
        mobileCard={(row) => (
          <AdminRecordCard
            title={row.venueName ?? "Referral"}
            status={
              <StatusPill tone={statusTone(row.status)}>
                {row.status}
              </StatusPill>
            }
            fields={[
              {
                label: "Referrer",
                value: row.referrerEmail
                  ? maskAdminContact(row.referrerEmail)
                  : "—",
              },
              {
                label: "Referred",
                value: row.referredEmail
                  ? maskAdminContact(row.referredEmail)
                  : "—",
              },
              { label: "Hold", value: row.holdReason ?? "—" },
              {
                label: "Retries / flags",
                value: `${row.retryCount} / ${row.fraudFlagCount}`,
              },
            ]}
          />
        )}
      />
    </AdminPanel>
  )
}
