import { recordConsentOptOutAction } from "@/app/admin/actions"
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
  adminSelectClasses,
  first,
  maskAdminCustomer,
} from "@/components/admin/support"
import { AdminIdChip } from "@/components/admin/id-chip"
import { AdminRecordActions } from "@/components/admin/record-actions"
import { AdminRecordCard } from "@/components/admin/record-card"
import { EmptyState, SectionHeader } from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { Input } from "@/components/ui/input"
import type { getAdminPrivacySupportRows } from "@/lib/admin/data"
import {
  ADMIN_CONSENT_SOURCE,
  MARKETING_POLICY_VERSION,
} from "@/lib/customer/consent"
import type { AdminLookupState } from "@/lib/admin/lookup-query"
import { Shield01Icon } from "@hugeicons/core-free-icons"

import { DataRequestForm } from "./data-request-form"

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

function PrivacySupportRecord({ row }: { readonly row: PrivacySupportRow }) {
  const customer = first(row.customers)
  const merchant = first(row.merchants)

  return (
    <AdminRecordCard
      title={maskAdminCustomer(customer)}
      fields={[
        {
          label: "Merchant",
          value: merchant?.business_name ?? "Merchant",
        },
        {
          label: "References",
          value: (
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              <AdminIdChip value={row.customer_id} prefix="customer" />
              <AdminIdChip value={row.merchant_id} prefix="merchant" />
              <AdminIdChip value={row.id} prefix="membership" />
            </span>
          ),
        },
      ]}
      action={
        <AdminRecordActions label="Privacy actions" group="privacy-record">
          <div className="grid gap-4 xl:grid-cols-2">
            <ConsentOptOutForm row={row} />
            <DataRequestForm row={row} />
          </div>
        </AdminRecordActions>
      }
    />
  )
}

function ConsentOptOutForm({ row }: { readonly row: PrivacySupportRow }) {
  return (
    <AdminActionForm action={recordConsentOptOutAction}>
      <input type="hidden" name="customerId" value={row.customer_id} />
      <input type="hidden" name="merchantId" value={row.merchant_id} />
      <input type="hidden" name="source" value={ADMIN_CONSENT_SOURCE} />
      <input
        type="hidden"
        name="policyVersion"
        value={MARKETING_POLICY_VERSION}
      />
      <AdminField label="Channel">
        <select name="channel" required className={adminSelectClasses}>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </AdminField>
      <AdminField label="Reason">
        <Input name="reason" required minLength={4} />
      </AdminField>
      <SubmitButton pendingLabel="Recording…">Record opt-out</SubmitButton>
    </AdminActionForm>
  )
}
