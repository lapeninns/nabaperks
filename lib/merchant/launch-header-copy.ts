/**
 * Pure launch-hub HEADER copy/hierarchy logic — no React, no I/O, so it is
 * unit-testable in isolation (tests/unit/launch-header-copy). Both the real
 * `/app/launch` route and the DB-free `/dev/app-harness/launch` harness resolve
 * their heading, mobile context line, desktop description, and header CTA from
 * this one function, so the two never drift and the hierarchy rules below are
 * enforced in one place.
 *
 * Hierarchy rules encoded here:
 * - The heading is stated ONCE. The mobile context line and the desktop
 *   description never repeat the heading, and the launchReady description never
 *   repeats the readiness panel banner's "Customers can scan…" sentence.
 * - Setup actions live after the active panel, so the header never competes
 *   with the journey's single footer CTA.
 */
import {
  needsLaunchBillingActivation,
  type LaunchReadiness,
} from "@/lib/merchant/launch-readiness-core"

/** Which tab the header jump-CTA targets, or null when it must be suppressed. */
export type LaunchHeaderActionTab = "qr" | "billing" | null

export type LaunchHeaderModel = {
  /** The single page-level heading — shared by the mobile h1 and desktop title. */
  readonly heading: string
  /** Mobile-only "what's left" line under the heading. Never repeats `heading`. */
  readonly mobileContext: string
  /** Desktop PageTitle description. Never repeats the heading or panel banner. */
  readonly description: string
  /** The header jump-CTA target, or null to suppress it. */
  readonly actionTab: LaunchHeaderActionTab
}

export function resolveLaunchHeaderModel(
  readiness: LaunchReadiness
): LaunchHeaderModel {
  if (readiness.launchReady) {
    return {
      heading: "You're live",
      mobileContext:
        "Setup is complete. Customers can scan, join, and collect stamps.",
      // The readiness panel banner already prints "Customers can scan…"; keep
      // the header additive by pointing at the QR rather than repeating it.
      description: "Your QR is live below when you need the link.",
      // On the QR tab this CTA would be a no-op, so suppress it there.
      actionTab: null,
    }
  }

  if (needsLaunchBillingActivation(readiness)) {
    return {
      heading: "Launch to unlock your QR",
      mobileContext:
        "Pay the launch fee, start the pilot, then create your venue QR.",
      description:
        "Pay the one-time launch fee and start your 28-day platform pilot to unlock the venue QR customers scan.",
      // On the billing tab the activation card carries the real Stripe checkout,
      // so the header CTA must not compete with it — suppress it there.
      actionTab: null,
    }
  }

  if (readiness.nextStep?.id === "qr") {
    return {
      heading: "One step from live",
      mobileContext: "Create your venue QR to start accepting scans.",
      description:
        "Billing is ready. Create your venue QR and place it at the till.",
      actionTab: null,
    }
  }

  return {
    heading: "Bring your venue to life",
    mobileContext: readiness.nextStep
      ? `${readiness.completed} of ${readiness.total} steps done. Next: ${readiness.nextStep.actionLabel}.`
      : `${readiness.total} setup steps to complete before you go live.`,
    description: `${readiness.total} setup checks and you're live. Create your QR once the earlier steps are done.`,
    actionTab: null,
  }
}
