import {
  AdminLookupErrorState,
  AdminLookupPagination,
} from "@/components/admin/lookup-controls"
import { AdminActionForm } from "@/components/admin/action-form"
import { AdminIdChip } from "@/components/admin/id-chip"
import { AdminRecordActions } from "@/components/admin/record-actions"
import { AdminRecordCard } from "@/components/admin/record-card"
import {
  AdminField,
  AdminPanel,
  SourceLabel,
  StatusPill,
  adminSelectClasses,
  formatAdminDate,
  maskAdminCustomer,
} from "@/components/admin/support"
import { EmptyState, SectionHeader } from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { Input } from "@/components/ui/input"
import type { getAdminUnaffiliatedCustomers } from "@/lib/admin/data"
import { MARKETING_POLICY_VERSION } from "@/lib/customer/consent"
import { Shield01Icon } from "@hugeicons/core-free-icons"

import {
  logUnaffiliatedDataRequestAction,
  recordUnaffiliatedConsentOptOutAction,
} from "./actions"

type UnaffiliatedResult = Awaited<
  ReturnType<typeof getAdminUnaffiliatedCustomers>
>
type UnaffiliatedRow = UnaffiliatedResult["rows"][number]

/**
 * Verified customers who never joined a venue (db privacy lifecycle). The
 * membership-based lookups above cannot surface them, so admins had no way to
 * discover or service a verified account with no membership. Reuses the page's
 * contact search; records account-wide actions without inventing a merchant
 * context.
 */
export function UnaffiliatedCustomersPanel({
  result,
  searching,
  hrefForPage,
}: {
  readonly result: UnaffiliatedResult | null
  readonly searching: boolean
  readonly hrefForPage: (page: number) => string
}) {
  return (
    <AdminPanel>
      <SectionHeader
        title="Verified customers without a membership"
        description="Verified customers who signed up but never joined a venue — invisible to the membership lookups above. Filtered by the contact search at the top of the page."
        actions={<SourceLabel>Source: service-role admin readback</SourceLabel>}
      />
      {result ? (
        result.rows.length ? (
          <>
            <div className="grid gap-3">
              {result.rows.map((row) => (
                <UnaffiliatedRecord key={row.id} row={row} />
              ))}
            </div>
            <AdminLookupPagination
              label="Unaffiliated customer pages"
              unit="customers"
              meta={result.meta}
              hrefForPage={hrefForPage}
            />
          </>
        ) : searching ? (
          <EmptyState
            icon={Shield01Icon}
            title="No matching customers"
            description="No unaffiliated customer matches that contact fragment."
            className="rounded-none border-0 p-0 shadow-none"
          />
        ) : (
          <EmptyState
            icon={Shield01Icon}
            title="No unaffiliated customers"
            description="Every verified customer has joined at least one venue."
            className="rounded-none border-0 p-0 shadow-none"
          />
        )
      ) : (
        <AdminLookupErrorState title="Unaffiliated lookup unavailable" />
      )}
    </AdminPanel>
  )
}

function UnaffiliatedRecord({ row }: { readonly row: UnaffiliatedRow }) {
  return (
    <AdminRecordCard
      title={maskAdminCustomer(row)}
      status={
        row.is_verified ? <StatusPill tone="good">Verified</StatusPill> : null
      }
      fields={[
        { label: "Signed up", value: formatAdminDate(row.created_at) },
        {
          label: "References",
          value: <AdminIdChip value={row.id} prefix="customer" />,
        },
      ]}
      action={
        <AdminRecordActions
          label="Account privacy actions"
          group="unaffiliated-privacy"
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <UnaffiliatedConsentOptOutForm customerId={row.id} />
            <UnaffiliatedDataRequestForm customerId={row.id} />
          </div>
        </AdminRecordActions>
      }
    />
  )
}

function UnaffiliatedConsentOptOutForm({
  customerId,
}: {
  readonly customerId: string
}) {
  return (
    <AdminActionForm action={recordUnaffiliatedConsentOptOutAction}>
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="privacyScope" value="unaffiliated" />
      <input type="hidden" name="source" value="support_request" />
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
          <option value="push">Push</option>
        </select>
      </AdminField>
      <AdminField label="Reason">
        <Input name="reason" required minLength={4} />
      </AdminField>
      <SubmitButton pendingLabel="Recording…">
        Record account-wide opt-out
      </SubmitButton>
    </AdminActionForm>
  )
}

function UnaffiliatedDataRequestForm({
  customerId,
}: {
  readonly customerId: string
}) {
  return (
    <AdminActionForm action={logUnaffiliatedDataRequestAction}>
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="privacyScope" value="unaffiliated" />
      <div className="grid grid-cols-2 gap-2">
        <AdminField label="Request type">
          <select name="requestType" required className={adminSelectClasses}>
            <option value="access">Access</option>
            <option value="export">Export</option>
            <option value="deletion">Deletion</option>
            <option value="rectification">Rectification</option>
          </select>
        </AdminField>
        <AdminField label="Channel">
          <select name="channel" required className={adminSelectClasses}>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="in_person">In person</option>
            <option value="other">Other</option>
          </select>
        </AdminField>
      </div>
      <AdminField label="Notes">
        <Input name="notes" required minLength={4} />
      </AdminField>
      <SubmitButton pendingLabel="Processing…" variant="secondary">
        Process account request
      </SubmitButton>
    </AdminActionForm>
  )
}
