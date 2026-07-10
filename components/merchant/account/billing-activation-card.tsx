import Link from "next/link"
import { CheckmarkBadge04Icon } from "@hugeicons/core-free-icons"

import { startCheckoutAction } from "@/app/app/billing/actions"
import { Eyebrow, Icon, ReceiptCard } from "@/components/brand"
import {
  BillingCheckoutForm,
  type BillingCheckoutAction,
} from "@/components/merchant/account/billing-checkout-form"
import { GUARANTEE, PRODUCT } from "@/lib/marketing/facts"

/**
 * First-run billing activation surface — plan facts, one primary "Proceed to
 * billing" action, no duplicate copy. Purely presentational (no DB reads): it
 * takes only the env-derived annual availability and an optional return path,
 * so the real launch/account {@link import("./billing-panel").BillingPanel} and
 * the DB-free `/dev/app-harness/launch?tab=billing` state both render this one
 * component. Checkout still runs through the `/app/billing` server action.
 */
export function SetupBillingActivationCard({
  annualBillingAvailable,
  billingReturnTo,
  checkoutAction = startCheckoutAction,
}: {
  annualBillingAvailable: boolean
  billingReturnTo?: string
  checkoutAction?: BillingCheckoutAction
}) {
  return (
    <ReceiptCard
      edge
      padding="sm"
      className="grid gap-4 sm:gap-5 sm:[--card-spacing:--spacing(6)]"
    >
      {/* The page header carries the state/progress ("One step from live");
          this card carries the ACTION. Titling it "Activate your venue" matches the
          billing-status copy and the account billing card, so every
          add-a-card surface shares one title instead of repeating the header. */}
      <div className="grid gap-2">
        <Eyebrow>Billing</Eyebrow>
        <h2 className="text-lg leading-snug font-extrabold text-foreground sm:text-xl">
          Activate your venue
        </h2>
        <p className="text-sm leading-6 text-pretty text-muted-foreground">
          Add a card through Stripe to activate your venue and start accepting
          stamps.
        </p>
      </div>

      <dl className="grid gap-0 rounded-lg border border-border bg-secondary/40 px-3 py-1 text-sm">
        <PlanRow label="Plan" value={PRODUCT.planName} />
        <PlanRow label="Free trial" value="30 days" />
        <PlanRow label="Due today" value="£0" />
        <PlanRow label="Then" value="£49 a month" />
        <PlanRow label="Billed" value="Per location" />
      </dl>

      <div className="grid gap-2">
        <BillingCheckoutForm
          checkoutAction={checkoutAction}
          annualBillingAvailable={annualBillingAvailable}
          returnTo={billingReturnTo}
          stacked
        />
        <p className="text-center text-xs leading-5 text-muted-foreground">
          Secure checkout via Stripe. {PRODUCT.cancelChip} from your billing
          page.
        </p>
        <div className="flex items-start gap-2 rounded-lg border border-reward/30 bg-reward/8 px-3 py-2">
          <Icon
            icon={CheckmarkBadge04Icon}
            size={16}
            className="mt-0.5 shrink-0 text-reward"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            <span className="font-bold text-foreground">{GUARANTEE.name}:</span>{" "}
            {GUARANTEE.line}
          </p>
        </div>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        <Link
          href="/app/account?tab=billing"
          className="font-bold text-foreground underline decoration-2 underline-offset-4"
        >
          Manage billing in Account
        </Link>{" "}
        once your venue is live.
      </p>
    </ReceiptCard>
  )
}

/** Dashed receipt line for a single plan fact. Shared by the billing surfaces. */
export function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dashed border-ink/15 py-2 last:border-b-0 sm:py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  )
}
