import { FileValidationIcon } from "@hugeicons/core-free-icons"

import { AdminRecordCard } from "@/components/admin/record-card"
import {
  AdminLookupErrorState,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import {
  AdminPanel,
  SourceLabel,
  StatusPill,
  first,
  formatAdminDate,
  maskAdminCustomer,
} from "@/components/admin/support"
import { EmptyState, SectionHeader } from "@/components/brand"
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
    <AdminPanel className="p-0">
      <div className="border-b p-5">
        <SectionHeader
          title="Consent log"
          description="Historical opt-in and opt-out records are retained as evidence."
          actions={<SourceLabel>Source: consent_records</SourceLabel>}
        />
      </div>
      {result ? (
        <>
          <DataTable
            caption="Admin consent support readback"
            cardBreakpoint="xl"
            className="rounded-none border-0 shadow-none"
            rows={result.rows}
            getRowKey={(record) => record.id}
            mobileClassName="p-5"
            emptyState={
              <EmptyState
                icon={FileValidationIcon}
                title="No consent records yet"
                className="rounded-none border-0 shadow-none"
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
                    { label: "Channel", value: record.channel },
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
                    {
                      label: "Source",
                      value: <SourceLabel>Source: {record.source}</SourceLabel>,
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
                key: "channel",
                header: "Channel",
                cell: (record) => record.channel,
              },
              {
                key: "source",
                header: "Source",
                cell: (record) => (
                  <SourceLabel>Source: {record.source}</SourceLabel>
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
            <div className="p-5">
              <AdminLookupPagination
                label="Consent record pages"
                unit="consent records"
                meta={result.meta}
                hrefForPage={hrefForPage}
              />
            </div>
          ) : null}
        </>
      ) : (
        <div className="p-5">
          <AdminLookupErrorState title="Consent readback unavailable" />
        </div>
      )}
    </AdminPanel>
  )
}
