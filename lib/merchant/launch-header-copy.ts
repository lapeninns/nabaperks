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
 * - The header action is a jump-to-tab CTA, so it is SUPPRESSED (actionTab null)
 *   whenever it would point at the tab already on screen — it must never compete
 *   with, or duplicate, the active panel's own primary action.
 */
import {
  needsLaunchBillingActivation,
  type LaunchHubTab,
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
  readiness: LaunchReadiness,
  activeTab: LaunchHubTab
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
      actionTab: activeTab === "qr" ? null : "qr",
    }
  }

  if (needsLaunchBillingActivation(readiness)) {
    return {
      heading: "One step from live",
      // State what's LEFT — never repeat the heading.
      mobileContext: "The last step before your venue goes live.",
      description: "The last step before your venue goes live.",
      // On the billing tab the activation card carries the real Stripe checkout,
      // so the header CTA must not compete with it — suppress it there.
      actionTab: activeTab === "billing" ? null : "billing",
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
