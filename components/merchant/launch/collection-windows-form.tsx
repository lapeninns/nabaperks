"use client"

import { useActionState, useState } from "react"

import {
  saveCollectionWindowsAction,
  type CollectionWindowActionState,
} from "@/app/app/launch/collection-actions"
import { PageTitle, ReceiptCard } from "@/components/brand"
import { FormField, SelectField, SubmitButton } from "@/components/forms"
import { Button } from "@/components/ui/button"
import {
  buildCollectionWindowDrafts,
  COLLECTION_DAYS,
  COLLECTION_TIME_OPTIONS,
  quietLunchPreset,
  type CollectionWindowDraft,
  type CollectionWindowSummary,
} from "@/lib/merchant/collection-window-fields"

type UpgradeOption = {
  readonly id: string
  readonly reward_name: string
  readonly is_active: boolean
}
type WindowSaveAction = (
  state: CollectionWindowActionState,
  data: FormData
) => Promise<CollectionWindowActionState>

export function CollectionWindowsForm({
  locationId,
  windows,
  rewardPoolItems,
  saveAction = saveCollectionWindowsAction,
}: {
  readonly locationId: string
  readonly windows: readonly CollectionWindowSummary[]
  readonly rewardPoolItems: readonly UpgradeOption[]
  readonly saveAction?: WindowSaveAction
}) {
  const [rows, setRows] = useState(() => buildCollectionWindowDrafts(windows))
  const [state, action, pending] = useActionState(saveAction, {})
  const upgrades = rewardPoolItems.filter((item) => item.is_active)

  function updateRow(key: string, update: Partial<CollectionWindowDraft>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...update } : row))
    )
  }

  return (
    <ReceiptCard className="grid min-w-0 gap-4">
      <PageTitle
        headingLevel={2}
        title="Collection windows"
        titleClassName="sm:text-xl"
        description="Set weekly reward collection times and an optional upgrade for each window."
      />
      <p className="text-sm text-muted-foreground" id="collection-owner-hint">
        Only the owner can collect rewards. Choose times when the owner will be
        at the venue. All times are UK local time. Each window must last at
        least 30 minutes.
      </p>
      <form
        action={action}
        className="grid min-w-0 gap-4"
        aria-describedby="collection-owner-hint"
      >
        <input type="hidden" name="locationId" value={locationId} />
        <input type="hidden" name="windows" value={JSON.stringify(rows)} />
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-11 w-fit text-left whitespace-normal"
          disabled={pending}
          onClick={() => setRows(quietLunchPreset())}
        >
          Quiet lunch · Mon–Thu 12:00–15:00
        </Button>
        <p className="text-sm text-muted-foreground">
          The preset replaces this week’s draft. Save to apply it. With no
          windows, collection has no weekly time restriction.
        </p>
        <fieldset disabled={pending} className="grid min-w-0 gap-4">
          <legend className="sr-only">Weekly collection schedule</legend>
          {COLLECTION_DAYS.map((day, index) => (
            <fieldset
              key={day}
              className="grid min-w-0 gap-3 border-t border-border pt-3"
            >
              <legend className="pr-2 font-bold">{day}</legend>
              {rows
                .filter((row) => row.isodow === index + 1)
                .map((row) => (
                  <WindowRow
                    key={row.key}
                    row={row}
                    day={day}
                    upgrades={upgrades}
                    onChange={(update) => updateRow(row.key, update)}
                  />
                ))}
              <Button
                type="button"
                variant="ghost"
                className="w-fit"
                onClick={() =>
                  setRows((current) => [
                    ...current,
                    {
                      key: crypto.randomUUID(),
                      isodow: index + 1,
                      startsAt: "15:00",
                      endsAt: "18:00",
                      upgradePoolItemId: "",
                      isActive: true,
                    },
                  ])
                }
              >
                Add another {day} window
              </Button>
            </fieldset>
          ))}
        </fieldset>
        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        <SubmitButton
          className="w-full sm:w-fit"
          pendingLabel="Saving windows…"
        >
          Save collection windows
        </SubmitButton>
      </form>
    </ReceiptCard>
  )
}

function WindowRow({
  row,
  day,
  upgrades,
  onChange,
}: {
  readonly row: CollectionWindowDraft
  readonly day: string
  readonly upgrades: readonly UpgradeOption[]
  readonly onChange: (update: Partial<CollectionWindowDraft>) => void
}) {
  const unavailableUpgrade =
    row.upgradePoolItemId &&
    !upgrades.some((item) => item.id === row.upgradePoolItemId)
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          className="focus-ring size-5 accent-primary"
          checked={row.isActive}
          onChange={(event) => onChange({ isActive: event.target.checked })}
        />
        {day} window enabled
      </label>
      {row.isActive ? (
        <>
          <FormField id={`window-${row.key}-start`} label="Starts">
            <SelectField
              value={row.startsAt}
              onChange={(event) => onChange({ startsAt: event.target.value })}
            >
              {COLLECTION_TIME_OPTIONS.filter((time) => time !== "24:00").map(
                (time) => (
                  <option key={time}>{time}</option>
                )
              )}
            </SelectField>
          </FormField>
          <FormField id={`window-${row.key}-end`} label="Ends">
            <SelectField
              value={row.endsAt}
              onChange={(event) => onChange({ endsAt: event.target.value })}
            >
              {COLLECTION_TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {time === "24:00" ? "24:00 (midnight)" : time}
                </option>
              ))}
            </SelectField>
          </FormField>
          <FormField id={`window-${row.key}-upgrade`} label="Upgrade reward">
            <SelectField
              value={row.upgradePoolItemId}
              onChange={(event) =>
                onChange({ upgradePoolItemId: event.target.value })
              }
            >
              <option value="">No upgrade</option>
              {unavailableUpgrade ? (
                <option value={row.upgradePoolItemId} disabled>
                  Unavailable reward — choose another
                </option>
              ) : null}
              {upgrades.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.reward_name}
                </option>
              ))}
            </SelectField>
          </FormField>
        </>
      ) : null}
    </div>
  )
}
