import "server-only"

import {
  getQrSetup,
  type ActiveCardSummary,
  type QrCodeSummary,
} from "@/lib/merchant/qr-code"

export type LaunchReadinessTab = "card" | "venue" | "qr"
export type LaunchReadinessStepId = "card" | "rewards" | "venue" | "qr"

export type LaunchReadinessStep = {
  id: LaunchReadinessStepId
  tab: LaunchReadinessTab
  label: string
  summary: string
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
      label: "Card built",
      summary: activeCard
        ? `${activeCard.card_name} · ${activeCard.stamps_required} visits`
        : "Create the visit card customers will collect.",
      ready: Boolean(activeCard),
      href: "/app/launch?tab=card",
      actionLabel: activeCard ? "Review card" : "Build card",
    },
    {
      id: "rewards",
      tab: "card",
      label: "Rewards loaded",
      summary:
        activeRewardPoolItemCount > 0
          ? `${activeRewardPoolItemCount} active mystery reward${activeRewardPoolItemCount === 1 ? "" : "s"}`
          : "Add at least one active reward to reveal.",
      ready: activeRewardPoolItemCount > 0,
      href: "/app/launch?tab=card",
      actionLabel: "Add reward",
    },
    {
      id: "venue",
      tab: "venue",
      label: "Venue set",
      summary: venueReady
        ? location?.require_geofence
          ? "Venue address is geocoded for GPS anomaly checks."
          : "Venue address is saved for printed QR checks."
        : "Save and geocode the venue address.",
      ready: venueReady,
      href: "/app/launch?tab=venue",
      actionLabel: "Save venue",
    },
    {
      id: "qr",
      tab: "qr",
      label: "QR live",
      summary: qrIsActive
        ? `Permanent QR ${qrCode?.qr_id ?? ""} is accepting scans.`
        : hasQr
          ? "Enable the permanent venue QR when venue setup is ready."
          : "Generate the permanent venue QR.",
      ready: qrIsActive,
      href: "/app/launch?tab=qr",
      actionLabel: hasQr ? "Open QR" : "Generate QR",
    },
  ]
  const completed = steps.filter((step) => step.ready).length
  const tabs = {
    card: steps
      .filter((step) => step.tab === "card")
      .every((step) => step.ready),
    venue: steps
      .filter((step) => step.tab === "venue")
      .every((step) => step.ready),
    qr: steps.filter((step) => step.tab === "qr").every((step) => step.ready),
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
