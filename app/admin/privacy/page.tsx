import {
  logDataRequestAction,
  recordConsentOptOutAction,
} from "@/app/admin/actions"
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
import { FileValidationIcon, Shield01Icon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { Button } from "@/components/ui/button"
import {
  getAdminConsentRecords,
  getAdminPrivacySupportRows,
} from "@/lib/admin/data"

export default async function AdminPrivacyPage() {
  const [supportRows, consentRecords] = await Promise.all([
    getAdminPrivacySupportRows(),
    getAdminConsentRecords(),
  ])

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
          actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
        />
        {supportRows.length ? (
          <div className="grid gap-3">
            {supportRows.map((row) => {
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
                  <form
                    action={recordConsentOptOutAction}
                    className="grid gap-2"
                  >
                    <input
                      type="hidden"
                      name="customerId"
                      value={row.customer_id}
                    />
                    <input
                      type="hidden"
                      name="merchantId"
                      value={row.merchant_id}
                    />
                    <input
                      type="hidden"
                      name="source"
                      value="support_request"
                    />
                    <input
                      type="hidden"
                      name="policyVersion"
                      value="2026-06-06"
                    />
                    <AdminField label="Channel">
                      <select
                        name="channel"
                        required
                        className={adminInputClasses}
                      >
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="whatsapp">WhatsApp</option>
                      </select>
                    </AdminField>
                    <AdminField label="Reason">
                      <input
                        name="reason"
                        required
                        minLength={4}
                        className={adminInputClasses}
                      />
                    </AdminField>
                    <Button type="submit">
                      Record opt-out
                    </Button>
                  </form>
                  <form action={logDataRequestAction} className="grid gap-2">
                    <input
                      type="hidden"
                      name="customerId"
                      value={row.customer_id}
                    />
                    <input
                      type="hidden"
                      name="merchantId"
                      value={row.merchant_id}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <AdminField label="Request type">
                        <select
                          name="requestType"
                          required
                          className={adminInputClasses}
                        >
                          <option value="access">Access</option>
                          <option value="export">Export</option>
                          <option value="deletion">Deletion</option>
                          <option value="rectification">Rectification</option>
                          <option value="consent">Consent</option>
                        </select>
                      </AdminField>
                      <AdminField label="Channel">
                        <select
                          name="channel"
                          required
                          className={adminInputClasses}
                        >
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                          <option value="in_person">In person</option>
                          <option value="other">Other</option>
                        </select>
                      </AdminField>
                    </div>
                    <AdminField label="Notes">
                      <input
                        name="notes"
                        required
                        minLength={4}
                        className={adminInputClasses}
                      />
                    </AdminField>
                    <Button type="submit" variant="secondary">
                      Log request
                    </Button>
                  </form>
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
          className="rounded-none border-0 shadow-none"
          rows={consentRecords}
          getRowKey={(record) => record.id}
          emptyState={
            <EmptyState
              icon={FileValidationIcon}
              title="No consent records yet"
              className="rounded-none border-0 shadow-none"
            />
          }
          columns={[
            {
              key: "customer",
              header: "Customer",
              cell: (record) => {
                const customer = first(record.customers)
                return maskAdminContact(customer?.email ?? customer?.phone)
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
                <StatusPill>{record.consent_status.replaceAll("_", " ")}</StatusPill>
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
              cell: (record) => <SourceLabel>Source: {record.source}</SourceLabel>,
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
      </AdminPanel>
    </div>
  )
}
