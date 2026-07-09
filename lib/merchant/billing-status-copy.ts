/**
 * Pure billing-status → merchant-facing copy/routing logic. No React, no I/O, so
 * it is unit-testable in isolation (tests/unit/billing-status-copy). The
 * presentation components (`MerchantBillingNotice`, `MerchantBillingAccessNote`)
 * in `components/merchant/billing-status.tsx` render this.
 *
 * Routing contract: `not_started` is the FIRST-RUN activation state and routes
 * to the launch billing step (`/app/launch?tab=billing`) with the shared
 * "Proceed to billing" verb; every post-activation attention state
 * (past_due/cancelled/suspended/…) routes to Account billing for management.
 */
export type BillingActionVariant = "default" | "secondary"

export type MerchantBillingCopy = {
  readonly title: string
  readonly description: string
  readonly className: string
  readonly noteClassName: string
  readonly titleClassName?: string
  readonly actionHref?: string
  readonly actionLabel?: string
  readonly actionVariant?: BillingActionVariant
}

const baseNoticeClassName = "rounded-lg border-2 p-5 shadow-sm"
const calmNoteClassName =
  "rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground"
const warningNoteClassName =
  "rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"

export function shouldShowMerchantDashboardBillingNotice(status: string) {
  const state = normalizeMerchantBillingStatus(status)
  return state !== "active" && state !== "trialing"
}

export function formatMerchantBillingStatus(status: string) {
  return normalizeMerchantBillingStatus(status).replaceAll("_", " ")
}

export function merchantBillingStateCopy(status: string): MerchantBillingCopy {
  const state = normalizeMerchantBillingStatus(status)
  const actionClassName = `${baseNoticeClassName} border-primary/30 bg-primary/10`
  const healthyClassName = `${baseNoticeClassName} border-reward/30 bg-reward/10`
  const warningClassName = `${baseNoticeClassName} border-destructive/30 bg-destructive/10`

  const states: Record<string, MerchantBillingCopy> = {
    not_started: {
      // First-run activation routes to the launch billing step (the single
      // activation destination), matching the launch header CTA and the setup
      // readiness rail. Post-activation states below stay on Account billing.
      title: "Activate your venue",
      description:
        "Add a billing card to activate your venue and start accepting stamps. You can set everything else up first.",
      className: actionClassName,
      noteClassName: calmNoteClassName,
      actionHref: "/app/launch?tab=billing",
      actionLabel: "Proceed to billing",
      actionVariant: "default",
    },
    trialing: {
      title: "Free trial active",
      description:
        "Your 30-day free trial is running, with everything switched on.",
      className: `${baseNoticeClassName} border-reward/30 bg-accent`,
      noteClassName: calmNoteClassName,
      actionHref: "/app/account?tab=billing",
      actionLabel: "View billing",
      actionVariant: "secondary",
    },
    active: {
      title: "Billing active",
      description:
        "Your subscription is active. Customers can join, collect stamps, and redeem rewards.",
      className: healthyClassName,
      noteClassName: calmNoteClassName,
      actionHref: "/app/account?tab=billing",
      actionLabel: "Manage billing",
      actionVariant: "secondary",
    },
    past_due: {
      title: `Billing ${formatMerchantBillingStatus(state)}`,
      description:
        "A payment needs attention. Your card still works for now, but please sort billing soon.",
      className: warningClassName,
      noteClassName: warningNoteClassName,
      titleClassName: "text-destructive",
      actionHref: "/app/account?tab=billing",
      actionLabel: "Resolve billing",
      actionVariant: "default",
    },
    cancelled: {
      title: `Billing ${formatMerchantBillingStatus(state)}`,
      description:
        "New stamps and rewards are paused until billing is restored.",
      className: warningClassName,
      noteClassName: warningNoteClassName,
      titleClassName: "text-destructive",
      actionHref: "/app/account?tab=billing",
      actionLabel: "Restart billing",
      actionVariant: "default",
    },
    suspended: {
      title: `Billing ${formatMerchantBillingStatus(state)}`,
      description:
        "New stamps and rewards are paused until billing is restored.",
      className: warningClassName,
      noteClassName: warningNoteClassName,
      titleClassName: "text-destructive",
      actionHref: "/app/account?tab=billing",
      actionLabel: "Restore access",
      actionVariant: "default",
    },
  }

  return (
    states[state] ?? {
      title: `Billing ${formatMerchantBillingStatus(state)}`,
      description:
        "We could not read your billing status just now. Refresh the page, or open billing to check.",
      className: `${baseNoticeClassName} border-border bg-card`,
      noteClassName: calmNoteClassName,
      actionHref: "/app/account?tab=billing",
      actionLabel: "Review billing",
      actionVariant: "secondary",
    }
  )
}

function normalizeMerchantBillingStatus(status: string) {
  return status === "trial" ? "trialing" : status
}
