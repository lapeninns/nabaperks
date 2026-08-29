"use client"

import { useActionState } from "react"

import {
  confirmOfferPassRedemptionAction,
  type MerchantOfferPassRedemptionActionState,
} from "@/app/app/offers/scan/[passToken]/actions"
import { FormMessage, SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty"
import {
  OFFER_PASS_ID_CHECK_LABEL,
  OFFER_PASS_NO_STACKING_LABEL,
  offerPassDiscountLabel,
} from "@/lib/offers/redeem-core"

const initialState: MerchantOfferPassRedemptionActionState = {}

/**
 * The human half of the two-step redemption. Scanning has already navigated
 * here read-only; nothing is redeemed until this form is posted.
 *
 * The no-stacking box is always shown. The ID box appears only when the
 * campaign asked for a check. Both are booleans: no document number, no image
 * and no date of birth is collected here or anywhere in this flow, and no bill
 * amount is asked for.
 */
export function MerchantOfferPassRedeemForm({
  scanToken,
  discountPercent,
  requiresIdCheck,
}: {
  scanToken: string
  discountPercent: number
  requiresIdCheck: boolean
}) {
  const [state, action] = useActionState(
    confirmOfferPassRedemptionAction,
    initialState
  )

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="scanToken" value={scanToken} />
      <input
        type="hidden"
        name="requiresIdCheck"
        value={requiresIdCheck ? "1" : "0"}
      />

      {state.errors?.form ? (
        <StatusBanner tone="warning" title="Discount not redeemed">
          {state.errors.form}
        </StatusBanner>
      ) : null}

      <fieldset className="grid gap-3">
        <legend className="sr-only">Confirm before redeeming</legend>

        {requiresIdCheck ? (
          <AttestationCheckbox
            name="idChecked"
            label={OFFER_PASS_ID_CHECK_LABEL}
            error={state.errors?.idCheck}
          />
        ) : null}

        <AttestationCheckbox
          name="noStacking"
          label={OFFER_PASS_NO_STACKING_LABEL}
          error={state.errors?.noStacking}
        />
      </fieldset>

      <SubmitButton
        size="lg"
        variant="reward"
        pendingLabel="Applying discount…"
      >
        Apply {offerPassDiscountLabel(discountPercent)}
      </SubmitButton>
    </form>
  )
}

function AttestationCheckbox({
  name,
  label,
  error,
}: {
  name: string
  label: string
  error?: string
}) {
  return (
    <div className="grid gap-1.5">
      <label className="focus-ring-within flex cursor-pointer items-start gap-3 rounded-lg border-2 border-border bg-card p-3 transition-[border-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] has-checked:border-ink motion-reduce:transition-none">
        <input
          type="checkbox"
          name={name}
          value="1"
          aria-invalid={error ? true : undefined}
          className="mt-0.5 size-4 shrink-0 accent-[var(--w-leaf)]"
        />
        <span className="text-sm leading-6 text-foreground">{label}</span>
      </label>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  )
}
