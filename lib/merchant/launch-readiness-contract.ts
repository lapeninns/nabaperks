export type LaunchSetupStepId = "card" | "rewards" | "venue"
export type LaunchReadinessTab = LaunchSetupStepId | "qr"
export type LaunchHubTab = LaunchReadinessTab | "billing"
export type LaunchChecklistStepId = LaunchSetupStepId | "qr" | "billing"
export type MerchantSetupStep = {
  readonly id: LaunchChecklistStepId
  readonly title: string
  readonly description: string
}

/**
 * Minimum number of active mystery rewards a merchant must publish before the
 * join QR can be provisioned and the venue can launch. This is the single
 * source of truth for the threshold — readiness, QR provisioning eligibility,
 * the QR action guard, and the setup panels all derive from it rather than
 * re-spelling the literal. User-facing copy that mentions "three" is kept
 * separately so wording can diverge from the gate without breaking it.
 */
export const LAUNCH_MIN_ACTIVE_REWARDS = 3

export const LAUNCH_CHECKLIST_STEP_ORDER = [
  "venue",
  "card",
  "rewards",
] as const satisfies ReadonlyArray<LaunchSetupStepId>

export const LAUNCH_SETUP_STEP_LABELS: Record<LaunchHubTab, string> = {
  card: "Your card",
  rewards: "Your rewards",
  venue: "Your venue",
  qr: "Venue QR",
  billing: "Billing",
}

export const MERCHANT_SETUP_STEPS = [
  {
    id: "venue",
    title: LAUNCH_SETUP_STEP_LABELS.venue,
    description: "Add your venue name and customer-facing address.",
  },
  {
    id: "card",
    title: LAUNCH_SETUP_STEP_LABELS.card,
    description:
      "Set the visit target and the mystery reward card customers collect.",
  },
  {
    id: "rewards",
    title: LAUNCH_SETUP_STEP_LABELS.rewards,
    description:
      "Add at least three live rewards so every full card has something to reveal.",
  },
  {
    id: "billing",
    title: LAUNCH_SETUP_STEP_LABELS.billing,
    description: "Start your free trial to unlock your permanent venue QR.",
  },
  {
    id: "qr",
    title: LAUNCH_SETUP_STEP_LABELS.qr,
    description:
      "Once billing is active, set up and share the venue QR customers use to collect stamps.",
  },
] as const satisfies ReadonlyArray<MerchantSetupStep>
