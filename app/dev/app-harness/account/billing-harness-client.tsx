"use client"

import { useCallback, useState } from "react"

import {
  type BillingCheckoutAction,
  type BillingCheckoutActionState,
} from "@/components/merchant/account/billing-checkout-form"
import {
  BillingPanelView,
  type BillingPanelOutcome,
} from "@/components/merchant/account/billing-panel-view"
import type { BillingPresentationSource } from "@/lib/merchant/billing-presentation"

export function BillingHarnessClient({
  billing,
  outcome,
  checkoutActionMode,
  refreshHref,
  requiresBilling = true,
}: {
  billing: BillingPresentationSource | null
  outcome: BillingPanelOutcome
  checkoutActionMode: "fail" | "safe"
  refreshHref: string
  requiresBilling?: boolean
}) {
  const [attemptCount, setAttemptCount] = useState(0)

  const checkoutAction: BillingCheckoutAction = useCallback(
    async (_previousState, formData): Promise<BillingCheckoutActionState> => {
      setAttemptCount((current) => current + 1)

      // Long enough for browser proof to observe the shared pending interlock,
      // short enough to keep the DB-free suite fast and deterministic.
      await new Promise((resolve) => window.setTimeout(resolve, 600))

      const interval = formData.get("interval")
      const intervalLabel = interval === "year" ? "annual" : "monthly"

      return checkoutActionMode === "fail"
        ? {
            status: "error",
            message:
              "Stripe could not open checkout. No billing was started; try again safely.",
          }
        : {
            status: "error",
            message:
              "The " +
              intervalLabel +
              " harness checkout stopped before contacting Stripe.",
          }
    },
    [checkoutActionMode]
  )

  const portalAction = useCallback(async () => {
    await Promise.resolve()
  }, [])

  return (
    <>
      <BillingPanelView
        billing={billing}
        outcome={outcome}
        requiresBilling={requiresBilling}
        annualBillingAvailable
        checkoutAction={checkoutAction}
        portalAction={portalAction}
        refreshHref={refreshHref}
      />
      <output
        data-testid="billing-checkout-attempts"
        aria-live="polite"
        className="sr-only"
      >
        {attemptCount}
      </output>
    </>
  )
}
