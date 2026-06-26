export type LaunchSetupStepId = "card" | "rewards" | "venue"
export type LaunchReadinessTab = LaunchSetupStepId | "qr"
export type LaunchHubTab = LaunchReadinessTab | "billing"
export type LaunchChecklistStepId = LaunchSetupStepId | "qr" | "billing"
export type MerchantSetupStep = {
  readonly id: LaunchChecklistStepId
  readonly title: string
  readonly description: string
}

export const LAUNCH_CHECKLIST_STEP_ORDER = [
  "venue",
  "card",
  "rewards",
] as const satisfies ReadonlyArray<LaunchSetupStepId>

export const LAUNCH_SETUP_STEP_LABELS: Record<LaunchHubTab, string> = {
  card: "Your card",
  rewards: "Your rewards",
  venue: "Business & venue",
  qr: "Launch kit",
  billing: "Billing",
}

export const MERCHANT_SETUP_STEPS = [
  {
    id: "venue",
    title: LAUNCH_SETUP_STEP_LABELS.venue,
    description:
      "Add your business profile, first venue, and customer-facing address.",
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
    id: "qr",
    title: LAUNCH_SETUP_STEP_LABELS.qr,
    description:
      "Print the poster, till card, and sticker for your permanent venue QR.",
  },
  {
    id: "billing",
    title: LAUNCH_SETUP_STEP_LABELS.billing,
    description:
      "Add a billing card to activate the venue after the free trial starts.",
  },
] as const satisfies ReadonlyArray<MerchantSetupStep>
