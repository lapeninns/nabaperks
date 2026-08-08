import type { ReactNode } from "react"

import { AdminCrossLinks } from "@/components/admin/cross-links"
import { AdminIdChip } from "@/components/admin/id-chip"
import { AdminRecordActions } from "@/components/admin/record-actions"
import {
  AdminEmptyState,
  AdminPanel,
  AdminPanelFooter,
  AdminPanelHeader,
  SourceLabel,
  StatusPill,
  formatAdminDate,
} from "@/components/admin/support"
import {
  AdminAppliedFilters,
  AdminLookupControls,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import { AdminRecordCard } from "@/components/admin/record-card"
import { BillingFulfilmentActions } from "@/components/admin/billing-fulfilment-actions"
import { CreditCardIcon } from "@hugeicons/core-free-icons"

import { PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { canRenderAdminPage } from "@/lib/admin/auth"
import {
  getAdminBillingRecordTotal,
  getAdminBillingRecords,
} from "@/lib/admin/billing-data"

type AdminBillingRecords = Awaited<ReturnType<typeof getAdminBillingRecords>>
type AdminBillingRow = AdminBillingRecords[number]
import {
  buildLookupHref,
  pageMeta,
  parseAdminLookupParams,
  type AdminSearchParams,
} from "@/lib/admin/lookup-query"

/**
 * Cross-links for a billing investigation: the merchant's account list and
 * their members, pre-filtered via the venue lookup param.
 */
function BillingCrossLinks({
  merchantName,
}: {
  readonly merchantName: string
}) {
  return (
    <AdminCrossLinks
      label={`${merchantName} related records`}
      links={[
        {
          label: "Account",
          href: buildLookupHref("/admin/merchants", { venue: merchantName }),
        },
        {
          label: "Members",
          href: buildLookupHref("/admin/customers", { venue: merchantName }),
        },
      ]}
    />
  )
}

function fulfilmentLabel(status: string): string {
  if (status === "awaiting_dispatch") return "Awaiting dispatch"
  if (status === "dispatched") return "Dispatched"
  if (status === "delivered") return "Delivered"
  return "Not started"
}

function fulfilmentTone(
  status: string,
  reviewRequired: boolean
): "neutral" | "good" | "warning" | "danger" {
  if (reviewRequired) return "danger"
  if (status === "delivered") return "good"
  if (status === "dispatched") return "warning"
  return "neutral"
}

export const metadata = { title: "Admin — Billing" }

type AdminBillingPageProps = {
  searchParams?: Promise<AdminSearchParams>
}

export default async function AdminBillingPage({
  searchParams,
}: AdminBillingPageProps) {
  if (!(await canRenderAdminPage())) return null

  const params = searchParams ? await searchParams : {}
  const lookup = parseAdminLookupParams(params)

  const [billing, billingTotal] = await Promise.all([
    getAdminBillingRecords(lookup),
    getAdminBillingRecordTotal(lookup),
  ])
  const meta = pageMeta(billingTotal, lookup.page)
  const hrefForPage = (page: number) =>
    buildLookupHref("/admin/billing", { venue: lookup.venue, page })

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Billing"
        description="Stripe subscription, poster fulfilment and delivery-anchored pilot state."
      />

      <AdminPanel variant="flush">
        {/* Every sibling panel carries the eyebrow/title/description/actions
            anatomy; this one was a lone provenance pill in a ~60px strip. */}
        <AdminPanelHeader>
          <SectionHeader
            title="Subscriptions and poster fulfilment"
            description="Stripe subscription state joined to poster dispatch, delivery confirmation and the delivery-anchored pilot window."
            actions={
              <SourceLabel>
                Source: billing_customers + merchant_launch_fulfilments
              </SourceLabel>
            }
          />
          {/* The readback used to be a hard cap of 100 newest rows with a
              truncation notice under it (ADM 04#6). A notice tells an operator
              the venue they cannot see might exist; a lookup lets them reach
              it. Venue only — a billing row has no customer dimension. */}
          <AdminLookupControls
            basePath="/admin/billing"
            lookup={lookup}
            label="Billing lookup"
            fields="venue"
          />
          <AdminAppliedFilters basePath="/admin/billing" lookup={lookup} />
        </AdminPanelHeader>
        <DataTable
          caption="Admin billing subscription readback"
          cardBreakpoint="xl"
          className="rounded-none border-0 shadow-none"
          mobileClassName="p-5"
          rows={billing}
          mobilePageSize={10}
          getRowKey={(row) => row.id}
          emptyState={
            lookup.venue ? (
              <AdminEmptyState
                icon={CreditCardIcon}
                title="No matching billing records"
                description="Adjust the venue search, or clear it to see the most recently updated records."
              />
            ) : (
              <AdminEmptyState
                icon={CreditCardIcon}
                title="No billing records yet"
              />
            )
          }
          columns={[
            {
              key: "merchant",
              header: "Merchant",
              cell: (row) => {
                return (
                  <div className="grid gap-1">
                    <span className="font-bold">{row.merchantName}</span>
                    <span className="text-muted-foreground">
                      {row.merchantEmail}
                    </span>
                    <BillingCrossLinks merchantName={row.merchantName} />
                  </div>
                )
              },
            },
            {
              key: "plan",
              header: "Plan",
              cell: (row) => row.plan,
            },
            {
              key: "status",
              header: "Status",
              cell: (row) => (
                <StatusPill tone={row.statusTone}>{row.statusLabel}</StatusPill>
              ),
            },
            {
              key: "period",
              header: "Period end",
              cell: (row) => (
                <div className="grid gap-1">
                  <span className="text-muted-foreground">
                    {formatAdminDate(row.currentPeriodEnd)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Updated {formatAdminDate(row.updatedAt)}
                  </span>
                </div>
              ),
            },
            {
              // The state plus the one decision-relevant date. Delivery, pilot
              // end and the Stripe sync stamp used to stack as three 12px
              // muted lines per row — the wrong register for dates an operator
              // must verify, and a third multi-line column on a table already
              // past its comfortable width. They live in the row's Details
              // disclosure now, and dates read as printed facts (.mono-meta),
              // not prose.
              key: "fulfilment",
              header: "Launch fulfilment",
              cell: (row) => (
                <div className="grid min-w-40 gap-2">
                  <StatusPill
                    tone={fulfilmentTone(
                      row.fulfilmentStatus,
                      row.operationsReviewRequired
                    )}
                  >
                    {row.operationsReviewRequired
                      ? "Needs attention"
                      : fulfilmentLabel(row.fulfilmentStatus)}
                  </StatusPill>
                  <span className="mono-meta text-muted-foreground">
                    Delivery {formatAdminDate(row.deliveredAt)}
                  </span>
                </div>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              cell: (row) => (
                <div className="grid min-w-52 gap-2">
                  <BillingFulfilmentActions
                    merchantId={row.merchantId}
                    fulfilmentStatus={row.fulfilmentStatus}
                    basePilotEndsAt={row.basePilotEndsAt}
                  />
                  <AdminRecordActions
                    label="Details"
                    group="billing-details-table"
                  >
                    <BillingDetails row={row} />
                  </AdminRecordActions>
                </div>
              ),
            },
          ]}
          mobileCard={(row) => {
            return (
              <AdminRecordCard
                title={row.merchantName}
                status={
                  <>
                    <StatusPill tone={row.statusTone}>
                      {row.statusLabel}
                    </StatusPill>
                    <StatusPill
                      tone={fulfilmentTone(
                        row.fulfilmentStatus,
                        row.operationsReviewRequired
                      )}
                    >
                      {row.operationsReviewRequired
                        ? "Needs attention"
                        : fulfilmentLabel(row.fulfilmentStatus)}
                    </StatusPill>
                  </>
                }
                // Four headline fields, not eleven. A card of eleven two-line
                // dt/dd stacks ran to ~800px before its action disclosure, and
                // no operator reads eleven labelled fields per merchant — the
                // decision-relevant ones were buried among Stripe refs. The
                // other seven are preserved verbatim in the Details
                // disclosure below.
                fields={[
                  { label: "Email", value: row.merchantEmail },
                  { label: "Plan", value: row.plan },
                  {
                    label: "Period end",
                    value: formatAdminDate(row.currentPeriodEnd),
                  },
                  {
                    label: "Links",
                    value: (
                      <BillingCrossLinks merchantName={row.merchantName} />
                    ),
                  },
                ]}
                action={
                  <>
                    <BillingFulfilmentActions
                      merchantId={row.merchantId}
                      fulfilmentStatus={row.fulfilmentStatus}
                      basePilotEndsAt={row.basePilotEndsAt}
                    />
                    <AdminRecordActions label="Details" group="billing-details">
                      <BillingDetails row={row} />
                    </AdminRecordActions>
                  </>
                }
              />
            )
          }}
        />
        {meta.total > 0 ? (
          <AdminPanelFooter className="pt-0">
            <AdminLookupPagination
              label="Billing pages"
              unit="billing records"
              meta={meta}
              hrefForPage={hrefForPage}
            />
          </AdminPanelFooter>
        ) : null}
      </AdminPanel>
    </div>
  )
}

/**
 * Everything the row summary no longer shows, in one place: the dates an
 * operator verifies during a billing investigation and the two Stripe
 * identifiers they paste into the dashboard. The refs go through AdminIdChip
 * (click-to-copy, full value in `title`) like every other identifier in the
 * console — they were the only ids rendered as plain, hand-selectable mono.
 */
function BillingDetails({ row }: { readonly row: AdminBillingRow }) {
  return (
    <dl className="grid gap-2.5 text-sm">
      <BillingDetail
        label="Poster fulfilment"
        value={
          row.operationsReviewRequired
            ? "Needs attention"
            : fulfilmentLabel(row.fulfilmentStatus)
        }
      />
      <BillingDetail
        label="Delivery confirmed"
        value={formatAdminDate(row.deliveredAt)}
      />
      <BillingDetail
        label="Included pilot end"
        value={formatAdminDate(row.basePilotEndsAt)}
      />
      <BillingDetail
        label="Stripe trial sync"
        value={`${row.syncStatus} · ${formatAdminDate(row.confirmedStripeTrialEnd)}`}
      />
      <BillingDetail label="Updated" value={formatAdminDate(row.updatedAt)} />
      <BillingDetail
        label="Stripe subscription"
        value={<AdminIdChip value={row.stripeSubscriptionRef} prefix="sub" />}
      />
      <BillingDetail
        label="Stripe customer"
        value={<AdminIdChip value={row.stripeCustomerRef} prefix="cus" />}
      />
    </dl>
  )
}

function BillingDetail({
  label,
  value,
}: {
  readonly label: string
  readonly value: ReactNode
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="eyebrow">{label}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere] break-words text-muted-foreground">
        {value}
      </dd>
    </div>
  )
}
