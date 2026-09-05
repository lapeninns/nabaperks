"use client"

import { useActionState, useState } from "react"

import {
  confirmMerchantRewardCollectionAction,
  type MerchantRewardCollectionActionState,
} from "@/app/app/rewards/scan/[scanToken]/actions"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"

const initialState: MerchantRewardCollectionActionState = {}
const DATE_OF_BIRTH_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

export function MerchantRewardCollectionForm({
  scanToken,
  idCheck,
}: {
  scanToken: string
  idCheck?: { fullName: string; dateOfBirth: string }
}) {
  const [state, action, pending] = useActionState(
    confirmMerchantRewardCollectionAction,
    initialState
  )
  const [idConfirmed, setIdConfirmed] = useState(false)

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="scanToken" value={scanToken} />
      {idCheck ? (
        <fieldset
          className="grid min-w-0 gap-4 rounded-xl border-2 border-ink bg-card p-4"
          disabled={pending}
        >
          <legend className="px-1 font-bold">Check photo ID in person</legend>
          <input type="hidden" name="collectionMode" value="verify_id" />
          <input
            type="hidden"
            name="expectedDateOfBirth"
            value={idCheck.dateOfBirth}
          />
          <dl className="grid gap-2">
            <div>
              <dt className="text-sm text-muted-foreground">Customer name</dt>
              <dd className="font-bold break-words">{idCheck.fullName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Date of birth</dt>
              <dd className="font-bold">
                {DATE_OF_BIRTH_FORMAT.format(
                  new Date(`${idCheck.dateOfBirth}T12:00:00Z`)
                )}
              </dd>
            </div>
          </dl>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              name="idConfirmed"
              value="true"
              checked={idConfirmed}
              onChange={(event) => setIdConfirmed(event.target.checked)}
              required
              className="mt-1 size-5 shrink-0 accent-primary"
            />
            <span>
              I checked the customer’s photo ID. The photo matches the customer,
              the date of birth matches, and they are 18 or over.
            </span>
          </label>
          <p className="text-sm text-muted-foreground">
            No ID or a mismatch? Do not collect the reward. Ask the customer to
            correct their profile, or contact Nabaperks support, then reopen the
            QR.
          </p>
        </fieldset>
      ) : null}
      {state.errors?.form ? (
        <StatusBanner tone="warning" title="Reward not collected">
          {state.errors.form}
        </StatusBanner>
      ) : null}
      <Button
        type="submit"
        size="lg"
        variant="reward"
        disabled={pending || Boolean(idCheck && !idConfirmed)}
      >
        {pending
          ? "Marking collected…"
          : idCheck
            ? "Verify ID and collect reward"
            : "Mark reward collected"}
      </Button>
    </form>
  )
}
