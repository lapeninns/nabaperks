import "server-only"

import {
  getQrSetup,
  type ActiveCardSummary,
  type QrCodeSummary,
} from "@/lib/merchant/qr-code"
import {
  LAUNCH_SETUP_STEP_LABELS,
  type LaunchReadinessStepId,
  type LaunchReadinessTab,
} from "@/lib/merchant/launch-readiness-contract"

export { LAUNCH_SETUP_STEP_LABELS }
export type { LaunchReadinessStepId, LaunchReadinessTab }

export type LaunchReadinessStep = {
  id: LaunchReadinessStepId
  tab: LaunchReadinessTab
  label: string
  ready: boolean
  href: string
  actionLabel: string
}

export type LaunchReadiness = {
  steps: LaunchReadinessStep[]
  completed: number
  total: number
  launchReady: boolean
  nextStep: LaunchReadinessStep | null
  tabs: Record<LaunchReadinessTab, boolean>
}

type BuildLaunchReadinessInput = {
  activeCard: ActiveCardSummary | null
  activeRewardPoolItemCount: number
  qrCode: QrCodeSummary | null
  location: {
    id: string
    name: string
    address: string | null
    latitude: number | null
    longitude: number | null
    geofence_radius_meters: number
    require_geofence: boolean
    geocoded_at: string | null
  } | null
}

type LaunchLocation = BuildLaunchReadinessInput["location"]

export function buildLaunchReadiness({
  activeCard,
  activeRewardPoolItemCount,
  qrCode,
  location,
}: BuildLaunchReadinessInput): LaunchReadiness {
  const cardReady = activeCard !== null
  const rewardsReady = activeRewardPoolItemCount >= 3
  const venueReady = isVenueReady(location)
  const qrReady = qrCode?.is_active === true
  const steps: LaunchReadinessStep[] = [
    {
      id: "card",
      tab: "card",
      label: LAUNCH_SETUP_STEP_LABELS.card,
      ready: cardReady,
      href: "/app/launch?tab=card",
      actionLabel: cardActionLabel(cardReady),
    },
    {
      id: "rewards",
      tab: "rewards",
      label: LAUNCH_SETUP_STEP_LABELS.rewards,
      ready: rewardsReady,
      href: "/app/launch?tab=rewards",
      actionLabel: "Add rewards",
    },
    {
      id: "venue",
      tab: "venue",
      label: LAUNCH_SETUP_STEP_LABELS.venue,
      ready: venueReady,
      href: "/app/launch?tab=venue",
      actionLabel: "Save venue",
    },
    {
      id: "qr",
      tab: "qr",
      label: LAUNCH_SETUP_STEP_LABELS.qr,
      ready: qrReady,
      href: "/app/launch?tab=qr",
      actionLabel: qrActionLabel(qrCode !== null),
    },
  ]
  const completed = steps.filter((step) => step.ready).length
  const tabs = {
    card: cardReady,
    rewards: rewardsReady,
    venue: venueReady,
    qr: qrReady,
  }

  return {
    steps,
    completed,
    total: steps.length,
    launchReady: completed === steps.length,
    nextStep: steps.find((step) => !step.ready) ?? null,
    tabs,
  }
}

function isVenueReady(location: LaunchLocation): boolean {
  if (!location?.address) {
    return false
  }

  return !location.require_geofence || hasVenueCoordinates(location)
}

function hasVenueCoordinates(location: NonNullable<LaunchLocation>): boolean {
  return location.latitude !== null && location.longitude !== null
}

function cardActionLabel(cardReady: boolean): string {
  return cardReady ? "Review card" : "Build card"
}

function qrActionLabel(hasQr: boolean): string {
  return hasQr ? "Open QR" : "Generate QR"
}

export async function getMerchantLaunchReadiness() {
  const setup = await getQrSetup()

  return buildLaunchReadiness({
    activeCard: setup.activeCard,
    activeRewardPoolItemCount: setup.activeRewardPoolItemCount,
    qrCode: setup.qrCode,
    location: setup.location,
  })
}
