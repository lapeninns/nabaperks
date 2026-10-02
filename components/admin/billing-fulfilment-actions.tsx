import {
  confirmLaunchDeliveredAction,
  extendLaunchPilotAction,
  markLaunchDispatchedAction,
} from "@/app/admin/billing/actions"
import { AdminActionForm } from "@/components/admin/action-form"
import { AdminRecordActions } from "@/components/admin/record-actions"
import { AdminField } from "@/components/admin/support"
import { SubmitButton } from "@/components/forms"
import { Input } from "@/components/ui/input"

export function BillingFulfilmentActions({
  merchantId,
  fulfilmentStatus,
  basePilotEndsAt,
}: {
  readonly merchantId: string
  readonly fulfilmentStatus:
    "not_started" | "awaiting_dispatch" | "dispatched" | "delivered"
  readonly basePilotEndsAt: string | null
}) {
  return (
    <AdminRecordActions label="Fulfilment controls" group="billing-fulfilment">
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:min-w-64">
        {fulfilmentStatus === "not_started" ||
        fulfilmentStatus === "awaiting_dispatch" ? (
          <AdminActionForm action={markLaunchDispatchedAction}>
            <input type="hidden" name="merchantId" value={merchantId} />
            <AdminField
              label="Dispatch time"
              helper="UTC. Leave blank to record the current time."
            >
              <Input
                type="datetime-local"
                name="dispatchedAt"
                className="px-2 text-xs md:text-sm"
              />
            </AdminField>
            <SubmitButton pendingLabel="Recording…" variant="secondary">
              Mark posters dispatched
            </SubmitButton>
          </AdminActionForm>
        ) : null}

        {fulfilmentStatus !== "delivered" ? (
          <AdminActionForm action={confirmLaunchDeliveredAction}>
            <input type="hidden" name="merchantId" value={merchantId} />
            <AdminField
              label="Delivery time"
              helper="UTC. Leave blank to confirm delivery now and start the pilot."
            >
              <Input
                type="datetime-local"
                name="deliveredAt"
                className="px-2 text-xs md:text-sm"
              />
            </AdminField>
            <SubmitButton pendingLabel="Confirming…">
              Confirm poster delivery
            </SubmitButton>
          </AdminActionForm>
        ) : null}

        {fulfilmentStatus === "delivered" ? (
          <AdminActionForm action={extendLaunchPilotAction}>
            <input type="hidden" name="merchantId" value={merchantId} />
            <AdminField
              label="Free extension ends"
              helper={`UTC. Must be later than ${formatDate(basePilotEndsAt)}.`}
            >
              <Input
                type="datetime-local"
                name="extensionEnd"
                required
                className="px-2 text-xs md:text-sm"
              />
            </AdminField>
            <SubmitButton pendingLabel="Extending…" variant="secondary">
              Extend platform pilot
            </SubmitButton>
          </AdminActionForm>
        ) : null}
      </div>
    </AdminRecordActions>
  )
}

function formatDate(value: string | null): string {
  if (!value) return "the included pilot end"
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value))
}
