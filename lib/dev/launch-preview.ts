import type {
  LaunchReadiness,
  LaunchReadinessStep,
} from "@/lib/merchant/launch-readiness"
import { LAUNCH_SETUP_STEP_LABELS } from "@/lib/merchant/launch-readiness-contract"

/**
 * Mock fixtures for the merchant launch-hub preview harness. Mirrors
 * `customer-flow-preview` so the redesigned launch UI can be screenshotted with
 * Playwright without a Supabase session — the real components render against
 * these props. Pure data plus type-only imports, so the e2e spec can import it
 * in plain Node without tripping `server-only`.
 */
export const LAUNCH_PREVIEW_MOCK = {
  merchantName: "Old Crown Girton",
  locationName: "Main counter",
  cardName: "Mystery Visit Card",
  stampsRequired: 3,
  shareUrl: "https://nabaperks.com/q/WHEF",
  address: "1 High Street, London E1 6AN",
  rewardTerms:
    "Complete 3 visits to reveal a surprise reward. Redeem from the next UK business day.",
} as const

type StepFlags = {
  card: boolean
  reward: boolean
  venue: boolean
  qr: boolean
}

function mockSteps(flags: StepFlags): LaunchReadinessStep[] {
  return [
    {
      id: "card",
      tab: "card",
      label: LAUNCH_SETUP_STEP_LABELS.card,
      ready: flags.card,
      href: "/app/launch?tab=card",
      actionLabel: flags.card ? "Review card" : "Build card",
    },
    {
      id: "rewards",
      tab: "rewards",
      label: LAUNCH_SETUP_STEP_LABELS.rewards,
      ready: flags.reward,
      href: "/app/launch?tab=rewards",
      actionLabel: "Add rewards",
    },
    {
      id: "venue",
      tab: "venue",
      label: LAUNCH_SETUP_STEP_LABELS.venue,
      ready: flags.venue,
      href: "/app/launch?tab=venue",
      actionLabel: "Save venue",
    },
    {
      id: "qr",
      tab: "qr",
      label: LAUNCH_SETUP_STEP_LABELS.qr,
      ready: flags.qr,
      href: "/app/launch?tab=qr",
      actionLabel: flags.qr ? "Open QR" : "Generate QR",
    },
  ]
}

export function mockLaunchReadiness(flags: StepFlags): LaunchReadiness {
  const steps = mockSteps(flags)
  const completed = steps.filter((step) => step.ready).length

  return {
    steps,
    completed,
    total: steps.length,
    launchReady: completed === steps.length,
    nextStep: steps.find((step) => !step.ready) ?? null,
    tabs: {
      card: flags.card,
      rewards: flags.reward,
      venue: flags.venue,
      qr: flags.qr,
    },
  }
}

export type LaunchPreviewStateId = (typeof LAUNCH_PREVIEW_STATES)[number]["id"]

export const LAUNCH_PREVIEW_STATES = [
  {
    id: "setup-card",
    screenshot: "01-setup-card.png",
    screenLabel: "Launch setup",
    heading: "Bring your venue to life",
    activeTab: "card",
    flags: { card: false, reward: false, venue: false, qr: false },
  },
  {
    id: "setup-rewards",
    screenshot: "02-setup-rewards.png",
    screenLabel: "Launch setup",
    heading: "Bring your venue to life",
    activeTab: "rewards",
    flags: { card: true, reward: false, venue: false, qr: false },
  },
  {
    id: "setup-venue",
    screenshot: "03-setup-venue.png",
    screenLabel: "Launch setup",
    heading: "Bring your venue to life",
    activeTab: "venue",
    flags: { card: true, reward: true, venue: false, qr: false },
  },
  {
    id: "live-kit",
    screenshot: "04-live-kit.png",
    screenLabel: "Launch live",
    heading: "You're live",
    activeTab: "qr",
    flags: { card: true, reward: true, venue: true, qr: true },
  },
] as const

const previewStateIds = new Set(LAUNCH_PREVIEW_STATES.map((state) => state.id))

export function launchPreviewPath(stateId: LaunchPreviewStateId): string {
  return `/dev/launch-preview/${stateId}`
}

export function isLaunchPreviewStateId(
  value: string
): value is LaunchPreviewStateId {
  return previewStateIds.has(value as LaunchPreviewStateId)
}

export function launchPreviewState(stateId: LaunchPreviewStateId) {
  const state = LAUNCH_PREVIEW_STATES.find((entry) => entry.id === stateId)

  if (!state) {
    throw new Error(`Unknown launch preview state: ${stateId}`)
  }

  return state
}
