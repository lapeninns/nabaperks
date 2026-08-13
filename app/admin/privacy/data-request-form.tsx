"use client"

import { useCallback, useState, type ChangeEvent, type ReactNode } from "react"

import { logDataRequestAction } from "@/app/admin/actions"
import { AdminActionForm } from "@/components/admin/action-form"
import { AdminField, adminSelectClasses } from "@/components/admin/support"
import { SubmitButton } from "@/components/forms"
import { Input } from "@/components/ui/input"
import { clearErasedMerchantOnboardingDraft } from "@/lib/merchant/onboarding-draft-storage"
import type { AdminActionState } from "@/lib/admin/action-state"

type DataRequestRow = {
  readonly customer_id: string
  readonly merchant_id: string
}

function DataRequestFields({
  row,
  requestType,
  onRequestTypeChange,
}: {
  readonly row: DataRequestRow
  readonly requestType: string
  readonly onRequestTypeChange: (event: ChangeEvent<HTMLSelectElement>) => void
}): ReactNode {
  return (
    <>
      <input type="hidden" name="customerId" value={row.customer_id} />
      <input type="hidden" name="merchantId" value={row.merchant_id} />
      <div className="grid grid-cols-2 gap-2">
        <AdminField label="Request type">
          <select
            name="requestType"
            required
            value={requestType}
            onChange={onRequestTypeChange}
            className={adminSelectClasses}
          >
            <option value="access">Access</option>
            <option value="export">Export</option>
            <option value="deletion">Deletion</option>
            <option value="rectification">Rectification</option>
            <option value="consent">Consent</option>
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
        <Input name="notes" required minLength={4} maxLength={2000} />
      </AdminField>
    </>
  )
}

export function DataRequestForm({ row }: { readonly row: DataRequestRow }) {
  const [requestType, setRequestType] = useState("access")
  const dataRequestAction = useCallback(
    async (state: AdminActionState, formData: FormData) => {
      const result = await logDataRequestAction(state, formData)
      if (
        result.status === "success" &&
        formData.get("requestType") === "deletion"
      ) {
        clearErasedMerchantOnboardingDraft(
          window.localStorage,
          window.sessionStorage,
          row.customer_id
        )
      }
      return result
    },
    [row.customer_id]
  )
  const fields = (
    <DataRequestFields
      row={row}
      requestType={requestType}
      onRequestTypeChange={(event) => setRequestType(event.target.value)}
    />
  )

  if (requestType === "export") {
    return (
      <form
        action="/admin/privacy/export"
        method="post"
        className="grid gap-2"
        aria-describedby="privacy-export-help"
      >
        {fields}
        <p id="privacy-export-help" className="text-sm text-muted-foreground">
          The protected download starts directly and is not kept in this page.
        </p>
        <SubmitButton pendingLabel="Preparing export…" variant="secondary">
          Download export
        </SubmitButton>
      </form>
    )
  }

  return (
    <AdminActionForm action={dataRequestAction}>
      {fields}
      <SubmitButton pendingLabel="Logging…" variant="secondary">
        Log request
      </SubmitButton>
    </AdminActionForm>
  )
}
