import Link from "next/link"

import {
  AdminPanel,
  SourceLabel,
  StatusPill,
  formatAdminDate,
} from "@/components/admin/support"
import { AdminRecordCard } from "@/components/admin/record-card"
import { BillingFulfilmentActions } from "@/components/admin/billing-fulfilment-actions"
import { CreditCardIcon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { canRenderAdminPage } from "@/lib/admin/auth"
import { getAdminBillingRecords } from "@/lib/admin/billing-data"
import { buildLookupHref } from "@/lib/admin/lookup-query"

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
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      <Link
        className="focus-ring rounded-sm font-semibold text-primary underline underline-offset-2 hover:text-[color-mix(in_srgb,var(--primary)_80%,var(--w-ink))]"
        href="/admin/merchants"
      >
        Account
      </Link>
      <Link
        className="focus-ring rounded-sm font-semibold text-primary underline underline-offset-2 hover:text-[color-mix(in_srgb,var(--primary)_80%,var(--w-ink))]"
        href={buildLookupHref("/admin/customers", { venue: merchantName })}
      >
        Members
      </Link>
    </span>
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

export default async function AdminBillingPage() {
  if (!(await canRenderAdminPage())) return null

  const billing = await getAdminBillingRecords()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Billing"
        description="Stripe subscription, poster fulfilment and delivery-anchored pilot state."
      />

      <AdminPanel className="p-0">
        <div className="border-b p-5">
          <SourceLabel>
            Source: billing_customers + merchant_launch_fulfilments
          </SourceLabel>
        </div>
        <DataTable
          caption="Admin billing subscription readback"
          cardBreakpoint="xl"
          className="rounded-none border-0 shadow-none"
          mobileClassName="p-5"
          rows={billing}
          getRowKey={(row) => row.id}
          emptyState={
            <EmptyState
              icon={CreditCardIcon}
              title="No billing records yet"
              className="rounded-none border-0 shadow-none"
            />
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
              key: "fulfilment",
              header: "Launch fulfilment",
              cell: (row) => (
                <div className="grid min-w-48 gap-2">
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
                  <span className="text-xs text-muted-foreground">
                    Delivery {formatAdminDate(row.deliveredAt)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Pilot end {formatAdminDate(row.basePilotEndsAt)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Stripe {row.syncStatus} ·{" "}
                    {formatAdminDate(row.confirmedStripeTrialEnd)}
                  </span>
                </div>
              ),
            },
            {
              key: "stripe",
              header: "Stripe refs",
              cell: (row) => (
                <div className="grid gap-1 font-mono text-xs">
                  <span>Subscription {row.stripeSubscriptionRef}</span>
                  <span className="text-muted-foreground">
                    Customer {row.stripeCustomerRef}
                  </span>
                </div>
              ),
            },
            {
              key: "actions",
              header: "Controls",
              cell: (row) => (
                <BillingFulfilmentActions
                  merchantId={row.merchantId}
                  fulfilmentStatus={row.fulfilmentStatus}
                  basePilotEndsAt={row.basePilotEndsAt}
                />
              ),
            },
          ]}
          mobileCard={(row) => {
            return (
              <AdminRecordCard
                title={row.merchantName}
                status={
                  <StatusPill tone={row.statusTone}>
                    {row.statusLabel}
                  </StatusPill>
                }
                fields={[
                  {
                    label: "Email",
                    value: row.merchantEmail,
                  },
                  {
                    label: "Links",
                    value: (
                      <BillingCrossLinks merchantName={row.merchantName} />
                    ),
                  },
                  { label: "Plan", value: row.plan },
                  {
                    label: "Period end",
                    value: formatAdminDate(row.currentPeriodEnd),
                  },
                  {
                    label: "Updated",
                    value: formatAdminDate(row.updatedAt),
                  },
                  {
                    label: "Poster fulfilment",
                    value: row.operationsReviewRequired
                      ? "Needs attention"
                      : fulfilmentLabel(row.fulfilmentStatus),
                  },
                  {
                    label: "Delivery confirmed",
                    value: formatAdminDate(row.deliveredAt),
                  },
                  {
                    label: "Included pilot end",
                    value: formatAdminDate(row.basePilotEndsAt),
                  },
                  {
                    label: "Stripe trial sync",
                    value: `${row.syncStatus} · ${formatAdminDate(row.confirmedStripeTrialEnd)}`,
                  },
                  {
                    label: "Stripe subscription",
                    value: row.stripeSubscriptionRef,
                    mono: true,
                  },
                  {
                    label: "Stripe customer",
                    value: row.stripeCustomerRef,
                    mono: true,
                  },
                ]}
                action={
                  <BillingFulfilmentActions
                    merchantId={row.merchantId}
                    fulfilmentStatus={row.fulfilmentStatus}
                    basePilotEndsAt={row.basePilotEndsAt}
                  />
                }
              />
            )
          }}
        />
      </AdminPanel>
    </div>
  )
}
