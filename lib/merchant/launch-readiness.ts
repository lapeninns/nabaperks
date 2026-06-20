import "server-only"

import {
  getQrSetup,
  type ActiveCardSummary,
  type QrCodeSummary,
} from "@/lib/merchant/qr-code"

export type LaunchReadinessTab = "card" | "rewards" | "venue" | "qr"
export type LaunchReadinessStepId = "card" | "rewards" | "venue" | "qr"

/** Merchant-facing names for the four launch setup steps (not customer stamps). */
export const LAUNCH_SETUP_STEP_LABELS: Record<LaunchReadinessStepId, string> = {
  card: "Your card",
  rewards: "Your rewards",
  venue: "Your venue",
  qr: "Print your QR",
}

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

export function buildLaunchReadiness({
  activeCard,
  activeRewardPoolItemCount,
  qrCode,
  location,
}: BuildLaunchReadinessInput): LaunchReadiness {
  const hasQr = Boolean(qrCode)
  const qrIsActive = Boolean(qrCode?.is_active)
  const venueReady = Boolean(
    location?.address &&
    (!location.require_geofence ||
      (location.latitude !== null && location.longitude !== null))
  )
  const steps: LaunchReadinessStep[] = [
    {
      id: "card",
      tab: "card",
      label: LAUNCH_SETUP_STEP_LABELS.card,
      ready: Boolean(activeCard),
      href: "/app/launch?tab=card",
      actionLabel: activeCard ? "Review card" : "Build card",
    },
    {
      id: "rewards",
      tab: "rewards",
      label: LAUNCH_SETUP_STEP_LABELS.rewards,
      ready: activeRewardPoolItemCount >= 3,
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
      ready: qrIsActive,
      href: "/app/launch?tab=qr",
      actionLabel: hasQr ? "Open QR" : "Generate QR",
    },
  ]
  const completed = steps.filter((step) => step.ready).length
  const tabs = {
    card: steps.find((step) => step.id === "card")?.ready ?? false,
    rewards: steps.find((step) => step.id === "rewards")?.ready ?? false,
    venue: steps.find((step) => step.id === "venue")?.ready ?? false,
    qr: steps.find((step) => step.id === "qr")?.ready ?? false,
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

export async function getMerchantLaunchReadiness() {
  const setup = await getQrSetup()

  return buildLaunchReadiness({
    activeCard: setup.activeCard,
    activeRewardPoolItemCount: setup.activeRewardPoolItemCount,
    qrCode: setup.qrCode,
    location: setup.location,
  })
}
