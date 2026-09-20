"use client"

import { useActionState } from "react"

import {
  addVenueClosureAction,
  endVenueClosureAction,
} from "@/app/app/launch/collection-actions"
import { PageTitle, ReceiptCard } from "@/components/brand"
import { FormField, SubmitButton } from "@/components/forms"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { VenueClosureSummary } from "@/lib/merchant/collection-window-fields"

const CLOSURE_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

function formatClosureDate(value: string): string {
  const parts = Object.fromEntries(
    CLOSURE_DATE.formatToParts(new Date(value)).map((part) => [
      part.type,
      part.value,
    ])
  )
  return `${parts.day}/${parts.month}/${parts.year} at ${parts.hour}:${parts.minute}`
}

export function VenueClosuresForm({
  locationId,
  closures,
  now,
  addAction = addVenueClosureAction,
  endAction = endVenueClosureAction,
}: {
  readonly locationId: string
  readonly closures: readonly VenueClosureSummary[]
  readonly now: string
  readonly addAction?: typeof addVenueClosureAction
  readonly endAction?: typeof endVenueClosureAction
}) {
  const [state, action, pending] = useActionState(addAction, {})
  const upcoming = closures.filter(
    (closure) =>
      !closure.ended_early_at && Date.parse(closure.ends_at) > Date.parse(now)
  )
  return (
    <ReceiptCard className="grid min-w-0 gap-4">
      <PageTitle
        headingLevel={2}
        title="Venue closures"
        titleClassName="sm:text-xl"
        description="Record a closure when members cannot collect their rewards. Eligible open rewards have their collection deadline extended."
      />
      <form action={action} className="grid min-w-0 gap-4">
        <input type="hidden" name="locationId" value={locationId} />
        <p className="text-sm text-muted-foreground">
          Enter UK local dates and times. A closure can last up to 90 days.
        </p>
        <fieldset
          disabled={pending}
          className="grid min-w-0 gap-4 sm:grid-cols-2"
        >
          <legend className="sr-only">New closure dates</legend>
          <FormField
            id="closure-starts"
            label="Closure starts"
            error={state.errors?.startsAt}
          >
            <Input
              name="startsAt"
              type="datetime-local"
              step={900}
              required
              defaultValue={state.fields?.startsAt}
            />
          </FormField>
          <FormField
            id="closure-ends"
            label="Closure ends"
            error={state.errors?.endsAt}
          >
            <Input
              name="endsAt"
              type="datetime-local"
              step={900}
              required
              defaultValue={state.fields?.endsAt}
            />
          </FormField>
          <div className="min-w-0 sm:col-span-2">
            <FormField
              id="closure-reason"
              label="Reason for closure"
              error={state.errors?.reason}
            >
              <Textarea
                name="reason"
                maxLength={200}
                required
                defaultValue={state.fields?.reason}
              />
            </FormField>
          </div>
        </fieldset>
        {state.errors?.form ? (
          <p role="alert" className="text-sm text-destructive">
            {state.errors.form}
          </p>
        ) : null}
        <SubmitButton
          className="w-full sm:w-fit"
          pendingLabel="Adding closure…"
        >
          Add closure
        </SubmitButton>
      </form>
      <div className="grid min-w-0 gap-3 border-t border-border pt-4">
        <h3 className="font-bold">Current and upcoming closures</h3>
        {upcoming.length ? (
          upcoming.map((closure) => (
            <div
              key={closure.id}
              className="grid min-w-0 gap-2 rounded-lg border border-border p-3"
            >
              <p className="font-medium break-words">{closure.reason}</p>
              <p className="text-sm text-muted-foreground">
                {formatClosureDate(closure.starts_at)} to{" "}
                {formatClosureDate(closure.ends_at)} (UK)
              </p>
              {Date.parse(closure.starts_at) < Date.parse(now) ? (
                <EndClosureForm closureId={closure.id} endAction={endAction} />
              ) : (
                <p className="text-sm text-muted-foreground">Scheduled</p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No current or upcoming closures.
          </p>
        )}
      </div>
    </ReceiptCard>
  )
}

function EndClosureForm({
  closureId,
  endAction,
}: {
  readonly closureId: string
  readonly endAction: typeof endVenueClosureAction
}) {
  const [state, action] = useActionState(endAction, {})
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="closureId" value={closureId} />
      <SubmitButton
        variant="outline"
        className="w-full sm:w-fit"
        pendingLabel="Ending closure…"
      >
        End closure now
      </SubmitButton>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
