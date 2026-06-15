import { CUSTOMER_FLOW_DEMO } from "./customer-flow-demo-types.ts"

export const CUSTOMER_FLOW_MOCK = {
  merchantName: "Bean & Batch",
  merchantSlug: CUSTOMER_FLOW_DEMO.merchantSlug,
  qrId: CUSTOMER_FLOW_DEMO.qrId,
  phone: CUSTOMER_FLOW_DEMO.phone,
  cardName: "Morning Ritual Mystery Card",
  stampsRequired: 3,
  minSpendPence: 350,
  rewardTerms:
    "Collect 3 qualifying visits to reveal a surprise reward, redeemable from the next UK business day.",
  assignedRewardName: "Free pint",
  assignedRewardTerms:
    "A pint of any cask ale or lager on the house. Valid from the next UK business day.",
  assignedRewardMinSpendPence: null as number | null,
  membershipId: "00000000-0000-4000-8000-000000000001",
  rewardId: "00000000-0000-4000-8000-0000000000aa",
  merchantTermsUrl: `/merchant/${CUSTOMER_FLOW_DEMO.merchantSlug}/terms`,
} as const

export type CustomerFlowPreviewStepId =
  (typeof CUSTOMER_FLOW_PREVIEW_STEPS)[number]["id"]

export const CUSTOMER_FLOW_PREVIEW_STEPS = [
  {
    id: "playbook",
    screenshot: "00-playbook/01-customer-flow-playbook.png",
    screenLabel: "Customer flow playbook",
    heading: "Customer flow playbook",
  },
  {
    id: "join-hero",
    screenshot: "01-join/01-join-hero.png",
    screenLabel: "Customer join",
    heading: "Keep your card on your phone",
  },
  {
    id: "join-phone",
    screenshot: "01-join/02-phone-filled.png",
    screenLabel: "Customer join",
    heading: "Save your card to your number",
  },
  {
    id: "join-otp",
    screenshot: "01-join/03-otp-sent.png",
    screenLabel: "Customer join",
    heading: "Enter your code",
  },
  {
    id: "join-terms",
    screenshot: "01-join/04-terms.png",
    screenLabel: "Customer join",
    heading: "Collect your first stamp",
  },
  {
    id: "stamp-day-1-confirm",
    screenshot: "02-stamp-day-1/01-confirm.png",
    screenLabel: "Customer stamp",
    heading: "Stamp it here",
  },
  {
    id: "card-1-of-3",
    screenshot: "02-stamp-day-1/02-card-1-of-3.png",
    screenLabel: "Customer card",
    heading: CUSTOMER_FLOW_MOCK.cardName,
  },
  {
    id: "stamp-day-2-confirm",
    screenshot: "03-stamp-day-2/01-confirm.png",
    screenLabel: "Customer stamp",
    heading: "Stamp it here",
  },
  {
    id: "card-2-of-3",
    screenshot: "03-stamp-day-2/02-card-2-of-3.png",
    screenLabel: "Customer card",
    heading: CUSTOMER_FLOW_MOCK.cardName,
  },
  {
    id: "stamp-day-3-confirm",
    screenshot: "04-stamp-day-3/01-confirm.png",
    screenLabel: "Customer stamp",
    heading: "Stamp it here",
  },
  {
    id: "card-3-of-3-unlocked",
    screenshot: "04-stamp-day-3/02-card-3-of-3-unlocked.png",
    screenLabel: "Customer card",
    heading: CUSTOMER_FLOW_MOCK.cardName,
  },
  {
    id: "reward-waiting",
    screenshot: "05-reward-waiting/01-reward-waiting.png",
    screenLabel: "Customer reward",
    heading: "Coffee upgrade",
  },
  {
    id: "reward-ready-profile",
    screenshot: "06-redeem/00-profile-gate.png",
    screenLabel: "Customer reward",
    heading: "Coffee upgrade",
  },
  {
    id: "reward-ready",
    screenshot: "06-redeem/01-reward-ready.png",
    screenLabel: "Customer reward",
    heading: "Coffee upgrade",
  },
  {
    id: "card-redeemed",
    screenshot: "06-redeem/02-card-reset-cycle.png",
    screenLabel: "Customer card",
    heading: CUSTOMER_FLOW_MOCK.cardName,
  },
  {
    id: "profile-complete",
    screenshot: "07-profile/01-complete.png",
    screenLabel: "Customer profile",
    heading: "Your details",
  },
  {
    id: "profile-incomplete",
    screenshot: "07-profile/02-incomplete.png",
    screenLabel: "Customer profile",
    heading: "Your details",
  },
  {
    id: "profile-email-verify",
    screenshot: "07-profile/03-email-verify.png",
    screenLabel: "Customer profile",
    heading: "Your details",
  },
] as const

const previewStepIds = new Set(
  CUSTOMER_FLOW_PREVIEW_STEPS.map((step) => step.id)
)

export function customerFlowPreviewPath(stepId: CustomerFlowPreviewStepId): string {
  return `/dev/customer-flow/preview/${stepId}`
}

export function isCustomerFlowPreviewStepId(
  value: string
): value is CustomerFlowPreviewStepId {
  return previewStepIds.has(value as CustomerFlowPreviewStepId)
}

export function customerFlowPreviewStep(stepId: CustomerFlowPreviewStepId) {
  const step = CUSTOMER_FLOW_PREVIEW_STEPS.find((entry) => entry.id === stepId)

  if (!step) {
    throw new Error(`Unknown customer-flow preview step: ${stepId}`)
  }

  return step
}

export function formatMockPence(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
}
