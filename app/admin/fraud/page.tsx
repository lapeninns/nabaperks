import {
  AdminPanel,
  SourceLabel,
  StatusPill,
  first,
  formatAdminDate,
} from "@/components/admin/support"
import { AdminRecordCard } from "@/components/admin/record-card"
import { AlertDiamondIcon, Cancel01Icon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { getAdminFraudSignals } from "@/lib/admin/data"

type AdminFraudSignals = Awaited<ReturnType<typeof getAdminFraudSignals>>
type FraudFlags = AdminFraudSignals["fraudFlags"]
type RedemptionFailures = AdminFraudSignals["failures"]

export default async function AdminFraudPage() {
  const fraud = await getAdminFraudSignals()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Fraud"
        description="Fraud flags, soft geofence anomalies, and security-related product events."
      />

      <FraudFlagsPanel flags={fraud.fraudFlags} />

      <RedemptionFailuresPanel failures={fraud.failures} />
    </div>
  )
}

function FraudFlagsPanel({ flags }: { readonly flags: FraudFlags }) {
  return (
    <AdminPanel>
      <SectionHeader
        title="Fraud flags"
        description="Security support signals with masked customer context and bucketed location evidence."
        actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
      />
      <DataTable
        caption="Admin fraud flag readback"
        cardBreakpoint="xl"
        className="rounded-lg shadow-none"
        rows={flags}
        getRowKey={(flag) => flag.id}
        emptyState={
          <EmptyState
            icon={AlertDiamondIcon}
            title="No fraud flags yet"
            className="rounded-none border-0 p-0 shadow-none"
          />
        }
        columns={[
          {
            key: "signal",
            header: "Signal",
            cell: (flag) => (
              <span className="font-bold">
                {flag.signal.replaceAll("_", " ")}
              </span>
            ),
          },
          {
            key: "cycle-stamp",
            header: "Cycle stamp",
            cell: (flag) => flag.cycleStampNumber ?? "-",
          },
          {
            key: "location-status",
            header: "Location status",
            cell: (flag) => (
              <span className="font-bold">{flag.locationStatus}</span>
            ),
          },
          {
            key: "distance",
            header: "Distance",
            cell: (flag) => flag.distanceBucket,
          },
          {
            key: "accuracy",
            header: "Accuracy",
            cell: (flag) => flag.accuracyBucket,
          },
          {
            key: "confidence",
            header: "Confidence",
            cell: (flag) => flag.confidence,
          },
          {
            key: "reason",
            header: "Reason",
            cell: (flag) => flag.reason.replaceAll("_", " "),
          },
          {
            key: "merchant",
            header: "Merchant",
            cell: (flag) => flag.merchant,
          },
          {
            key: "customer",
            header: "Customer",
            cell: (flag) => (
              <span className="text-muted-foreground">
                {flag.maskedCustomer}
              </span>
            ),
          },
          {
            key: "severity",
            header: "Severity",
            cell: (flag) => (
              <StatusPill tone="warning">{flag.severity}</StatusPill>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (flag) => <StatusPill>{flag.status}</StatusPill>,
          },
          {
            key: "when",
            header: "When",
            cell: (flag) => (
              <time
                className="text-muted-foreground"
                dateTime={flag.created_at}
              >
                {formatAdminDate(flag.created_at)}
              </time>
            ),
          },
        ]}
        mobileCard={(flag) => (
          <AdminRecordCard
            title={flag.signal.replaceAll("_", " ")}
            status={
              <>
                <StatusPill tone="warning">{flag.severity}</StatusPill>
                <StatusPill>{flag.status}</StatusPill>
              </>
            }
            fields={[
              { label: "Merchant", value: flag.merchant },
              { label: "Customer", value: flag.maskedCustomer },
              {
                label: "Cycle stamp",
                value: flag.cycleStampNumber ?? "-",
              },
              { label: "Location", value: flag.locationStatus },
              { label: "Distance", value: flag.distanceBucket },
              { label: "Reason", value: flag.reason.replaceAll("_", " ") },
              {
                label: "When",
                value: (
                  <time dateTime={flag.created_at}>
                    {formatAdminDate(flag.created_at)}
                  </time>
                ),
              },
            ]}
          />
        )}
      />
    </AdminPanel>
  )
}

function RedemptionFailuresPanel({
  failures,
}: {
  readonly failures: RedemptionFailures
}) {
  return (
    <AdminPanel>
      <SectionHeader
        title="Redemption failures"
        description="Product-event failures retained for support analysis without exposing raw RPC payloads."
        actions={<SourceLabel>Source: product_events</SourceLabel>}
      />
      <DataTable
        caption="Admin redemption failure event readback"
        cardBreakpoint="xl"
        className="rounded-lg shadow-none"
        rows={failures}
        getRowKey={(event) => event.id}
        emptyState={
          <EmptyState
            icon={Cancel01Icon}
            title="No redemption failures yet"
            className="rounded-none border-0 p-0 shadow-none"
          />
        }
        columns={[
          {
            key: "event",
            header: "Event",
            cell: (event) => (
              <span className="font-bold">{event.event_name}</span>
            ),
          },
          {
            key: "merchant",
            header: "Merchant",
            cell: (event) => {
              const merchant = first(event.merchants)
              return merchant?.business_name ?? "Merchant"
            },
          },
          {
            key: "when",
            header: "When",
            cell: (event) => (
              <time
                className="text-muted-foreground"
                dateTime={event.created_at}
              >
                {formatAdminDate(event.created_at)}
              </time>
            ),
          },
        ]}
        mobileCard={(event) => {
          const merchant = first(event.merchants)
          return (
            <AdminRecordCard
              title={event.event_name}
              fields={[
                {
                  label: "Merchant",
                  value: merchant?.business_name ?? "Merchant",
                },
                {
                  label: "When",
                  value: (
                    <time dateTime={event.created_at}>
                      {formatAdminDate(event.created_at)}
                    </time>
                  ),
                },
              ]}
            />
          )
        }}
      />
    </AdminPanel>
  )
}
