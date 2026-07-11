"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { CreditCardIcon } from "@hugeicons/core-free-icons"

import { Icon, STATUS_ICON } from "@/components/brand"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { PRODUCT } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

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
  annualBillingAvailable,
  returnTo,
  stacked = false,
  monthlyLabel = `Proceed to billing · ${PRODUCT.price}`,
  annualLabel = `Pay yearly · ${PRODUCT.priceAnnual} · ${PRODUCT.annualSaving}`,
}: {
  checkoutAction: BillingCheckoutAction
  annualBillingAvailable: boolean
  returnTo?: string
  /** Keep long first-run plan choices on separate rows at every breakpoint. */
  stacked?: boolean
  monthlyLabel?: string
  annualLabel?: string
}) {
  const [state, formAction, pending] = useActionState(
    checkoutAction,
    IDLE_BILLING_CHECKOUT_ACTION_STATE
  )
  const [pendingInterval, setPendingInterval] = useState<"month" | "year">(
    "month"
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
        className={cn("grid gap-2", !stacked && "sm:grid-cols-2")}
      >
        {returnTo ? (
          <input type="hidden" name="returnTo" value={returnTo} />
        ) : null}

        {/* h-auto + whitespace-normal: the plan labels are long enough that
            the Button base's nowrap otherwise sets a ~360px intrinsic floor
            and drags the whole receipt past a 320px viewport. */}
        <Button
          type="submit"
          name="interval"
          value="month"
          disabled={pending}
          onClick={() => setPendingInterval("month")}
          className="h-auto min-h-11 w-full whitespace-normal"
        >
          <Icon icon={CreditCardIcon} size={16} />
          {monthlyLabel}
        </Button>

        {annualBillingAvailable ? (
          <Button
            type="submit"
            name="interval"
            value="year"
            variant="outline"
            disabled={pending}
            onClick={() => setPendingInterval("year")}
            className="h-auto min-h-11 w-full whitespace-normal"
          >
            {annualLabel}
          </Button>
        ) : null}

        {pending ? (
          <p
            role="status"
            aria-live="polite"
            className={cn(
              "text-xs leading-5 font-bold text-muted-foreground",
              !stacked && "sm:col-span-2"
            )}
          >
            {pendingInterval === "year"
              ? "Opening annual Stripe checkout…"
              : "Opening monthly Stripe checkout…"}
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
