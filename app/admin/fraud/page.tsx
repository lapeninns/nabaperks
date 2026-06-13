import {
  AdminPanel,
  SourceLabel,
  StatusPill,
  first,
  formatAdminDate,
  maskAdminContact,
} from "@/components/admin/support"
import { EmptyState, PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { getAdminFraudSignals } from "@/lib/admin/data"

export default async function AdminFraudPage() {
  const fraud = await getAdminFraudSignals()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Fraud"
        description="Fraud flags, station PIN attempts, and security-related product events."
      />

      <AdminPanel>
        <SectionHeader
          title="Fraud flags"
          description="Security support signals with masked customer context and labelled metadata."
          actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
        />
        <DataTable
          caption="Admin fraud flag readback"
          className="rounded-lg shadow-none"
          rows={fraud.fraudFlags}
          getRowKey={(flag) => flag.id}
          emptyState={
            <EmptyState
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
              key: "context",
              header: "Context",
              cell: (flag) => {
                const merchant = first(flag.merchants)
                const customer = first(flag.customers)
                return (
                  <span className="text-muted-foreground">
                    {merchant?.business_name ?? "Merchant"}
                    {customer
                      ? ` · ${maskAdminContact(customer.email ?? customer.phone)}`
                      : ""}
                  </span>
                )
              },
            },
            {
              key: "severity",
              header: "Severity",
              cell: (flag) => <StatusPill tone="warning">{flag.severity}</StatusPill>,
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
                <time className="text-muted-foreground" dateTime={flag.created_at}>
                  {formatAdminDate(flag.created_at)}
                </time>
              ),
            },
          ]}
        />
      </AdminPanel>

      <AdminPanel>
        <SectionHeader
          title="Staff PIN attempts"
          description="Station-side staff PIN attempt telemetry for support review."
          actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
        />
        <DataTable
          caption="Admin station PIN attempt readback"
          className="rounded-lg shadow-none"
          rows={fraud.pinAttempts}
          getRowKey={(attempt) => attempt.id}
          emptyState={
            <EmptyState
              title="No PIN attempts yet"
              className="rounded-none border-0 p-0 shadow-none"
            />
          }
          columns={[
            {
              key: "result",
              header: "Result",
              cell: (attempt) => (
                <StatusPill tone={attempt.success ? "good" : "danger"}>
                  {attempt.success ? "Successful PIN" : "Failed PIN"}
                </StatusPill>
              ),
            },
            {
              key: "merchant",
              header: "Merchant",
              cell: (attempt) => {
                const merchant = first(attempt.merchants)
                return merchant?.business_name ?? "Merchant"
              },
            },
            {
              key: "when",
              header: "When",
              cell: (attempt) => (
                <time
                  className="text-muted-foreground"
                  dateTime={attempt.created_at}
                >
                  {formatAdminDate(attempt.created_at)}
                </time>
              ),
            },
          ]}
        />
      </AdminPanel>

      <AdminPanel>
        <SectionHeader
          title="Redemption failures"
          description="Product-event failures retained for support analysis without exposing raw RPC payloads."
          actions={<SourceLabel>Source: product_events</SourceLabel>}
        />
        <DataTable
          caption="Admin redemption failure event readback"
          className="rounded-lg shadow-none"
          rows={fraud.failures}
          getRowKey={(event) => event.id}
          emptyState={
            <EmptyState
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
                <time className="text-muted-foreground" dateTime={event.created_at}>
                  {formatAdminDate(event.created_at)}
                </time>
              ),
            },
          ]}
        />
      </AdminPanel>
    </div>
  )
}
