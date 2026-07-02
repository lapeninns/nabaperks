import {
  logDataRequestAction,
  recordConsentOptOutAction,
} from "@/app/admin/actions"
import { AdminActionForm } from "@/components/admin/action-form"
import {
  AdminLookupControls,
  AdminLookupErrorState,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import {
  AdminField,
  AdminPanel,
  SourceLabel,
  adminInputClasses,
  first,
  maskAdminContact,
} from "@/components/admin/support"
import { EmptyState, SectionHeader } from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import type { getAdminPrivacySupportRows } from "@/lib/admin/data"
import type { AdminLookupState } from "@/lib/admin/lookup-query"
import { Shield01Icon } from "@hugeicons/core-free-icons"

type PrivacySupportResult = Awaited<
  ReturnType<typeof getAdminPrivacySupportRows>
>
type PrivacySupportRow = PrivacySupportResult["rows"][number]

export function DataRequestWorkflowPanel({
  result,
  lookup,
  hrefForPage,
}: {
  readonly result: PrivacySupportResult | null
  readonly lookup: AdminLookupState
  readonly hrefForPage: (page: number) => string
}) {
  const searching = Boolean(lookup.venue || lookup.contact)

  return (
    <AdminPanel>
      <SectionHeader
        title="Data request workflow"
        description="Verify the requester outside this console, find the relevant customer and merchant row by venue or contact fragment, log the request, then handle export, deletion, or consent follow-up manually until self-service exists."
        actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
      />
      <AdminLookupControls
        basePath="/admin/privacy"
        lookup={lookup}
        label="Data request subject lookup"
      />
      {result ? (
        result.rows.length ? (
          <>
            <div className="grid gap-3">
              {result.rows.map((row) => (
                <PrivacySupportRecord key={row.id} row={row} />
              ))}
            </div>
            <AdminLookupPagination
              label="Privacy support pages"
              unit="memberships"
              meta={result.meta}
              hrefForPage={hrefForPage}
            />
          </>
        ) : searching ? (
          <EmptyState
            icon={Shield01Icon}
            title="No matching memberships"
            description="Adjust the venue or contact search, or clear it to see the newest memberships."
            className="rounded-none border-0 p-0 shadow-none"
          />
        ) : (
          <EmptyState
            icon={Shield01Icon}
            title="No privacy support rows yet"
            description="No customer memberships are available for privacy support yet."
            className="rounded-none border-0 p-0 shadow-none"
          />
        )
      ) : (
        <AdminLookupErrorState title="Privacy lookup unavailable" />
      )}
    </AdminPanel>
  )
}

function PrivacySupportRecord({
  row,
}: {
  readonly row: PrivacySupportRow
}) {
  const customer = first(row.customers)
  const merchant = first(row.merchants)

  return (
    <article className="grid gap-4 rounded-lg border p-4 xl:grid-cols-[1fr_360px_360px]">
      <div>
        <p className="font-bold">
          {maskAdminContact(customer?.email ?? customer?.phone)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {merchant?.business_name ?? "Merchant"}
        </p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          customer:{row.customer_id.slice(0, 8)} · merchant:
          {row.merchant_id.slice(0, 8)} · membership:{row.id.slice(0, 8)}
        </p>
      </div>
      <ConsentOptOutForm row={row} />
      <DataRequestForm row={row} />
    </article>
  )
}

function ConsentOptOutForm({ row }: { readonly row: PrivacySupportRow }) {
  return (
    <AdminActionForm action={recordConsentOptOutAction}>
      <input type="hidden" name="customerId" value={row.customer_id} />
      <input type="hidden" name="merchantId" value={row.merchant_id} />
      <input type="hidden" name="source" value="support_request" />
      <input type="hidden" name="policyVersion" value="2026-06-06" />
      <AdminField label="Channel">
        <select name="channel" required className={adminInputClasses}>
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
      <SubmitButton pendingLabel="Recording…">Record opt-out</SubmitButton>
    </AdminActionForm>
  )
}

function DataRequestForm({ row }: { readonly row: PrivacySupportRow }) {
  return (
    <AdminActionForm action={logDataRequestAction}>
      <input type="hidden" name="customerId" value={row.customer_id} />
      <input type="hidden" name="merchantId" value={row.merchant_id} />
      <div className="grid grid-cols-2 gap-2">
        <AdminField label="Request type">
          <select name="requestType" required className={adminInputClasses}>
            <option value="access">Access</option>
            <option value="export">Export</option>
            <option value="deletion">Deletion</option>
            <option value="rectification">Rectification</option>
            <option value="consent">Consent</option>
          </select>
        </AdminField>
        <AdminField label="Channel">
          <select name="channel" required className={adminInputClasses}>
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
      <SubmitButton pendingLabel="Logging…" variant="secondary">
        Log request
      </SubmitButton>
    </AdminActionForm>
  )
}
