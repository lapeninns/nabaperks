import { FileValidationIcon } from "@hugeicons/core-free-icons"

import { AdminRecordCard } from "@/components/admin/record-card"
import {
  AdminLookupErrorState,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import {
  AdminEmptyState,
  AdminPanel,
  AdminPanelFooter,
  AdminPanelHeader,
  SourceLabel,
  StatusPill,
  first,
  formatAdminDate,
  maskAdminCustomer,
} from "@/components/admin/support"
import { SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import type { getAdminConsentRecords } from "@/lib/admin/data"

type ConsentRecordsResult = Awaited<ReturnType<typeof getAdminConsentRecords>>

export function ConsentLogPanel({
  result,
  hrefForPage,
}: {
  readonly result: ConsentRecordsResult | null
  readonly hrefForPage: (page: number) => string
}) {
  return (
    <AdminPanel variant="flush">
      <AdminPanelHeader>
        <SectionHeader
          title="Consent log"
          description="Historical opt-in and opt-out records are retained as evidence."
          actions={<SourceLabel>Source: consent_records</SourceLabel>}
        />
      </AdminPanelHeader>
      {result ? (
        <>
          <DataTable
            caption="Admin consent support readback"
            cardBreakpoint="xl"
            className="rounded-none border-0 shadow-none"
            rows={result.rows}
            getRowKey={(record) => record.id}
            mobileClassName="p-5"
            mobilePageSize={10}
            emptyState={
              <AdminEmptyState
                icon={FileValidationIcon}
                title="No consent records yet"
              />
            }
            mobileCard={(record) => {
              const customer = first(record.customers)
              const merchant = first(record.merchants)
              return (
                <AdminRecordCard
                  title={maskAdminCustomer(customer)}
                  status={
                    <StatusPill>
                      {record.consent_status.replaceAll("_", " ")}
                    </StatusPill>
                  }
                  fields={[
                    {
                      label: "Merchant",
                      value: merchant?.business_name ?? "Merchant",
                    },
                    {
                      label: "Channel",
                      value: `${record.channel} · ${record.source}`,
                    },
                    { label: "Policy", value: record.policy_version },
                    {
                      label: "When",
                      mono: true,
                      value: (
                        <time dateTime={record.created_at}>
                          {formatAdminDate(record.created_at)}
                        </time>
                      ),
                    },
                  ]}
                />
              )
            }}
            columns={[
              {
                key: "customer",
                header: "Customer",
                cell: (record) => {
                  const customer = first(record.customers)
                  return maskAdminCustomer(customer)
                },
              },
              {
                key: "merchant",
                header: "Merchant",
                cell: (record) => {
                  const merchant = first(record.merchants)
                  return merchant?.business_name ?? "Merchant"
                },
              },
              {
                key: "status",
                header: "Status",
                cell: (record) => (
                  <StatusPill>
                    {record.consent_status.replaceAll("_", " ")}
                  </StatusPill>
                ),
              },
              {
                // Channel and source merged: "Source:" was a constant 14
                // characters repeated down a whole column on a table already
                // fighting for width, and the panel header already says the
                // records come from consent_records.
                key: "channel",
                header: "Channel",
                cell: (record) => (
                  <span className="grid gap-1">
                    <span>{record.channel}</span>
                    <span className="mono-meta text-muted-foreground">
                      {record.source}
                    </span>
                  </span>
                ),
              },
              {
                key: "policy",
                header: "Policy",
                cell: (record) => record.policy_version,
              },
              {
                key: "when",
                header: "When",
                cell: (record) => (
                  <time
                    className="text-muted-foreground"
                    dateTime={record.created_at}
                  >
                    {formatAdminDate(record.created_at)}
                  </time>
                ),
              },
            ]}
          />
          {result.meta.total > 0 ? (
            <AdminPanelFooter>
              <AdminLookupPagination
                label="Consent record pages"
                unit="consent records"
                meta={result.meta}
                hrefForPage={hrefForPage}
              />
            </AdminPanelFooter>
          ) : null}
        </>
      ) : (
        <AdminPanelFooter>
          <AdminLookupErrorState title="Consent readback unavailable" />
        </AdminPanelFooter>
      )}
    </AdminPanel>
  )
}
