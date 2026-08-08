import Link from "next/link"
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
import {
  AdminAppliedFilters,
  AdminLookupControls,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import { SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { Button } from "@/components/ui/button"
import type {
  AdminReferralOpsPage,
  AdminReferralVenueMatch,
} from "@/lib/admin/data"
import {
  buildLookupHref,
  type AdminLookupState,
} from "@/lib/admin/lookup-query"

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
  referrals,
  lookup,
  hrefForPage,
}: {
  readonly referrals: AdminReferralOpsPage
  readonly lookup: AdminLookupState
  readonly hrefForPage: (page: number) => string
}) {
  const ambiguous = referrals.venueMatches.length > 1

  return (
    <AdminPanel>
      <SectionHeader
        title="Referral records"
        description="Referrer and referred member, current state and hold reason, timeline, and retry/fraud signals."
        actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
      />
      {/* The readback was the newest 100 referrals with no filter, no total
          and no signpost (04#6). Venue only: the RPC exposes no searchable
          member contact, and the emails it does return are masked here. */}
      <AdminLookupControls
        basePath="/admin/referrals"
        lookup={lookup}
        label="Referral lookup"
        fields="venue"
      />
      <AdminAppliedFilters basePath="/admin/referrals" lookup={lookup} />
      {ambiguous ? (
        <VenueDisambiguation matches={referrals.venueMatches} />
      ) : null}
      <DataTable
        caption="Admin referral ops readback"
        cardBreakpoint="xl"
        className="rounded-lg shadow-none"
        rows={referrals.rows}
        getRowKey={(row) => row.referralId}
        emptyState={
          ambiguous ? (
            <AdminEmptyState
              icon={UserGroupIcon}
              title="Choose a venue"
              description="The venue search matches more than one venue; pick one above to see its referrals."
              padded={false}
            />
          ) : lookup.venue ? (
            <AdminEmptyState
              icon={UserGroupIcon}
              title="No matching referrals"
              description={
                referrals.venueMatches.length === 0
                  ? "No venue name contains that fragment. Clear the search to see every referral."
                  : "That venue has no referral records yet."
              }
              padded={false}
            />
          ) : (
            <AdminEmptyState
              icon={UserGroupIcon}
              title="No referrals yet"
              padded={false}
            />
          )
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
      {referrals.meta.total > 0 ? (
        <AdminLookupPagination
          label="Referral pages"
          unit="referral records"
          meta={referrals.meta}
          hrefForPage={hrefForPage}
        />
      ) : null}
    </AdminPanel>
  )
}

/**
 * `admin_referral_ops` filters by one venue id, so a fragment matching several
 * venues cannot be pushed down. Applying it to whichever venue sorted first
 * would silently answer a different question, so the operator picks; each chip
 * re-submits the exact name, which then resolves to one venue.
 */
function VenueDisambiguation({
  matches,
}: {
  readonly matches: readonly AdminReferralVenueMatch[]
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">
        That search matches{" "}
        <span className="numeric-tabular">{matches.length}</span> venues. Choose
        one:
      </p>
      <p className="flex flex-wrap gap-2">
        {matches.map((match) => (
          <Button key={match.id} asChild variant="secondary" size="xs">
            <Link
              href={buildLookupHref("/admin/referrals", { venue: match.name })}
            >
              <span className="min-w-0 truncate">{match.name}</span>
            </Link>
          </Button>
        ))}
      </p>
    </div>
  )
}
