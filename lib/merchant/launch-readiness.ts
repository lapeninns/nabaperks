import "server-only"

import {
  getQrSetup,
  type ActiveCardSummary,
  type QrCodeSummary,
} from "@/lib/merchant/qr-code"
import {
  listStaffMembers,
  type StaffMember,
} from "@/lib/merchant/staff-members"
import { listStations, type StationSummary } from "@/lib/merchant/stations"

export type LaunchReadinessTab = "card" | "staff" | "qr"
export type LaunchReadinessStepId =
  | "card"
  | "rewards"
  | "staff"
  | "station"
  | "qr"

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
  staffMembers: StaffMember[]
  stations: StationSummary[]
}

export function buildLaunchReadiness({
  activeCard,
  activeRewardPoolItemCount,
  qrCode,
  staffMembers,
  stations,
}: BuildLaunchReadinessInput): LaunchReadiness {
  const activeStaffCount = staffMembers.filter(
    (member) => member.isActive
  ).length
  const hasActiveStation = stations.some(
    (station) => station.status === "active"
  )
  const hasQr = Boolean(qrCode)
  const qrIsActive = Boolean(qrCode?.is_active)
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
      id: "staff",
      tab: "staff",
      label: "Staff named",
      summary:
        activeStaffCount > 0
          ? `${activeStaffCount} active staff member${activeStaffCount === 1 ? "" : "s"}`
          : "Add the people who can approve stamps.",
      ready: activeStaffCount > 0,
      href: "/app/launch?tab=staff",
      actionLabel: "Add staff",
    },
    {
      id: "station",
      tab: "staff",
      label: "Station paired",
      summary: hasActiveStation
        ? "A counter station is paired and ready."
        : "Pair one till or counter device.",
      ready: hasActiveStation,
      href: "/app/launch?tab=staff",
      actionLabel: "Pair station",
    },
    {
      id: "qr",
      tab: "qr",
      label: "QR live",
      summary: qrIsActive
        ? `Permanent QR ${qrCode?.qr_id ?? ""} is accepting scans.`
        : hasQr
          ? "Enable the permanent venue QR when staff are ready."
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
    staff: steps
      .filter((step) => step.tab === "staff")
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
  const [setup, staffMembers, stations] = await Promise.all([
    getQrSetup(),
    listStaffMembers(),
    listStations(),
  ])

  return buildLaunchReadiness({
    activeCard: setup.activeCard,
    activeRewardPoolItemCount: setup.activeRewardPoolItemCount,
    qrCode: setup.qrCode,
    staffMembers,
    stations,
  })
}
