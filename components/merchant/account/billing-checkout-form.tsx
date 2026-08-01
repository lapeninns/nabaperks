"use client"

import { useActionState, useEffect, useRef } from "react"
import { CreditCardIcon } from "@hugeicons/core-free-icons"

import { Icon, STATUS_ICON } from "@/components/brand"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { PRODUCT } from "@/lib/marketing/facts"

export type BillingCheckoutActionState =
  | { status: "idle" }
  | { status: "error"; message: string }

export const IDLE_BILLING_CHECKOUT_ACTION_STATE: BillingCheckoutActionState = {
  status: "idle",
}

export type BillingCheckoutAction = (
  previousState: BillingCheckoutActionState,
  formData: FormData
) => Promise<BillingCheckoutActionState>

export function BillingCheckoutForm({
  checkoutAction,
  returnTo,
  label = `Continue · ${PRODUCT.launchFee} launch · then ${PRODUCT.price}`,
  annualLabel = `Pay annually · ${PRODUCT.launchFee} launch · then ${PRODUCT.annualPrice}`,
}: {
  checkoutAction: BillingCheckoutAction
  returnTo?: string
  label?: string
  annualLabel?: string
}) {
  const [state, formAction, pending] = useActionState(
    checkoutAction,
    IDLE_BILLING_CHECKOUT_ACTION_STATE
  )
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state.status === "error") {
      errorRef.current?.focus()
    }
  }, [state])

  return (
    <div className="grid gap-3">
      <form
        action={formAction}
        aria-busy={pending}
        data-billing-checkout-form
        className="grid gap-2"
      >
        {returnTo ? (
          <input type="hidden" name="returnTo" value={returnTo} />
        ) : null}

        {/* h-auto + whitespace-normal: the plan labels are long enough that
            the Button base's nowrap otherwise sets a ~360px intrinsic floor
            and drags the whole receipt past a 320px viewport. */}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="submit"
            name="interval"
            value="day"
            disabled={pending}
            className="h-auto min-h-11 w-full whitespace-normal"
          >
            <Icon icon={CreditCardIcon} size={16} />
            {label}
          </Button>
          <Button
            type="submit"
            name="interval"
            value="year"
            disabled={pending}
            variant="secondary"
            className="h-auto min-h-11 w-full whitespace-normal"
          >
            <Icon icon={CreditCardIcon} size={16} />
            {annualLabel}
          </Button>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          Annual prepay starts after the same 28-day pilot.{" "}
          {PRODUCT.annualSaving}
        </p>

        {pending ? (
          <p
            role="status"
            aria-live="polite"
            className="text-xs leading-5 font-bold text-muted-foreground"
          >
            Opening Stripe checkout…
          </p>
        ) : null}
      </form>

      {state.status === "error" && !pending ? (
        <Alert
          ref={errorRef}
          tabIndex={-1}
          aria-labelledby="billing-checkout-error-title"
          className="border-2 border-ink bg-destructive/10 text-destructive-strong"
        >
          <Icon icon={STATUS_ICON.error} className="text-current" />
          <AlertTitle
            id="billing-checkout-error-title"
            className="font-extrabold"
          >
            Billing was not started
          </AlertTitle>
          <AlertDescription className="text-current">
            {state.message}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
