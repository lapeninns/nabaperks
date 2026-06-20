import { FileValidationIcon, Shield01Icon } from "@hugeicons/core-free-icons"

import {
  AdminField,
  AdminPanel,
  SourceLabel,
  StatusPill,
  adminInputClasses,
  first,
  formatAdminDate,
  maskAdminContact,
} from "@/components/admin/support"
import { AdminRecordCard } from "@/components/admin/record-card"
import { EmptyState, PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { Button } from "@/components/ui/button"
import {
  ADMIN_CONSENT_RECORDS,
  ADMIN_PRIVACY_ROWS,
  type AdminConsentRow,
  type AdminPrivacyRow,
} from "./mock-data"
import { PreviewActionForm } from "./preview-forms"

/**
 * Mirror of `/admin/privacy`. Reuses the real consent `DataTable`, masking, and
 * `AdminPanel` chrome. The opt-out and data-request forms render statically
 * (disabled) — their `recordConsentOptOutAction` / `logDataRequestAction`
 * server actions are not imported.
 */
export function AdminPrivacyScreen() {
  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Privacy support"
        description="Consent readback and audited support actions for privacy, export, deletion, and opt-out requests."
      />

      <AdminPanel>
        <SectionHeader
          title="Data request workflow"
          description="Verify the requester outside this console, identify the relevant customer and merchant row, log the request, then handle export, deletion, or consent follow-up manually until self-service exists."
          actions={
            <SourceLabel>Source: service-role admin readback</SourceLabel>
          }
        />
        {ADMIN_PRIVACY_ROWS.length ? (
          <div className="grid gap-3">
            {ADMIN_PRIVACY_ROWS.map((row: AdminPrivacyRow) => {
              const customer = first(row.customers)
              const merchant = first(row.merchants)
              return (
                <article
                  key={row.id}
                  className="grid gap-4 rounded-lg border p-4 xl:grid-cols-[1fr_360px_360px]"
                >
                  <div>
                    <p className="font-bold">
                      {maskAdminContact(customer?.email ?? customer?.phone)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {merchant?.business_name ?? "Merchant"}
                    </p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      customer:{row.customer_id.slice(0, 8)} · merchant:
                      {row.merchant_id.slice(0, 8)} · membership:
                      {row.id.slice(0, 8)}
                    </p>
                  </div>
                  <PreviewActionForm className="grid gap-2">
                    <AdminField label="Channel">
                      <select className={adminInputClasses} disabled>
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="whatsapp">WhatsApp</option>
                      </select>
                    </AdminField>
                    <AdminField label="Reason">
                      <input className={adminInputClasses} disabled />
                    </AdminField>
                    <Button type="button" disabled>
                      Record opt-out
                    </Button>
                  </PreviewActionForm>
                  <PreviewActionForm className="grid gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <AdminField label="Request type">
                        <select className={adminInputClasses} disabled>
                          <option value="access">Access</option>
                          <option value="export">Export</option>
                          <option value="deletion">Deletion</option>
                          <option value="rectification">Rectification</option>
                          <option value="consent">Consent</option>
                        </select>
                      </AdminField>
                      <AdminField label="Channel">
                        <select className={adminInputClasses} disabled>
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                          <option value="in_person">In person</option>
                          <option value="other">Other</option>
                        </select>
                      </AdminField>
                    </div>
                    <AdminField label="Notes">
                      <input className={adminInputClasses} disabled />
                    </AdminField>
                    <Button type="button" variant="secondary" disabled>
                      Log request
                    </Button>
                  </PreviewActionForm>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={Shield01Icon}
            title="No privacy support rows yet"
            description="No customer memberships are available for privacy support yet."
            className="rounded-none border-0 p-0 shadow-none"
          />
        )}
      </AdminPanel>

      <AdminPanel className="p-0">
        <div className="border-b p-5">
          <SectionHeader
            title="Consent log"
            description="Historical opt-in and opt-out records are retained as evidence."
            actions={<SourceLabel>Source: consent_records</SourceLabel>}
          />
        </div>
        <DataTable
          caption="Admin consent support readback"
          cardBreakpoint="lg"
          className="rounded-none border-0 shadow-none"
          rows={ADMIN_CONSENT_RECORDS}
          getRowKey={(record: AdminConsentRow) => record.id}
          mobileClassName="p-5"
          emptyState={
            <EmptyState
              icon={FileValidationIcon}
              title="No consent records yet"
              className="rounded-none border-0 shadow-none"
            />
          }
          mobileCard={(record: AdminConsentRow) => {
            const customer = first(record.customers)
            const merchant = first(record.merchants)
            return (
              <AdminRecordCard
                title={maskAdminContact(customer?.email ?? customer?.phone)}
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
              cell: (record: AdminConsentRow) => {
                const customer = first(record.customers)
                return maskAdminContact(customer?.email ?? customer?.phone)
              },
            },
            {
              key: "merchant",
              header: "Merchant",
              cell: (record: AdminConsentRow) => {
                const merchant = first(record.merchants)
                return merchant?.business_name ?? "Merchant"
              },
            },
            {
              key: "status",
              header: "Status",
              cell: (record: AdminConsentRow) => (
                <StatusPill>
                  {record.consent_status.replaceAll("_", " ")}
                </StatusPill>
              ),
            },
            {
              key: "channel",
              header: "Channel",
              cell: (record: AdminConsentRow) => record.channel,
            },
            {
              key: "source",
              header: "Source",
              cell: (record: AdminConsentRow) => (
                <SourceLabel>Source: {record.source}</SourceLabel>
              ),
            },
            {
              key: "policy",
              header: "Policy",
              cell: (record: AdminConsentRow) => record.policy_version,
            },
            {
              key: "when",
              header: "When",
              cell: (record: AdminConsentRow) => (
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
      </AdminPanel>
    </div>
  )
}
