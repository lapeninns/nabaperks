import { notFound } from "next/navigation"

import { MoreListSkeleton } from "@/components/merchant/loading-skeletons"
import { MoreList } from "@/components/merchant/more-list"
import { MoreRailRedirect } from "@/components/merchant/more-rail-redirect"
import { buildMoreRows, type MoreRowsInput } from "@/lib/merchant/more-model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function noopSignOutAction() {
  "use server"
}

const FULL: MoreRowsInput = {
  printKitDownloaded: true,
  memberCount: 1842,
  activeOfferName: "Two-stamp Tuesday",
  lastAnnouncementAt: "2026-09-19T17:30:00.000Z",
  setup: { completed: 5, total: 5, launchReady: true },
  billingStatus: "active",
  trialDaysLeft: null,
}

const STATES: Record<string, MoreRowsInput> = {
  default: FULL,
  "subtitles-failed": {
    printKitDownloaded: null,
    memberCount: null,
    activeOfferName: null,
    lastAnnouncementAt: null,
    setup: null,
    billingStatus: null,
    trialDaysLeft: null,
  },
  "setup-incomplete": {
    ...FULL,
    printKitDownloaded: false,
    activeOfferName: "",
    lastAnnouncementAt: "",
    setup: { completed: 3, total: 5, launchReady: false },
    billingStatus: "not_started",
  },
  "billing-past-due": { ...FULL, billingStatus: "past_due" },
  "billing-not-required": { ...FULL, billingStatus: "not_required" },
  trial: { ...FULL, billingStatus: "trialing", trialDaysLeft: 12 },
}

/**
 * More harness — the REAL {@link MoreList} from the pure row builder with
 * literal inputs: every subtitle present, every subtitle failed, setup
 * incomplete, billing past due, trial, log out in flight, and loading.
 * `?redirect=1` mounts the rail redirect (to the dashboard lane) so the
 * 900px behaviour is provable without a login.
 */
export default async function MoreHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<{ state?: string; redirect?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const state = params.state ?? "default"

  if (state === "loading") {
    return <MoreListSkeleton />
  }

  return (
    <>
      {params.redirect === "1" ? (
        <MoreRailRedirect to="/dev/app-harness/dashboard" />
      ) : null}
      <MoreList
        rows={buildMoreRows(STATES[state] ?? FULL)}
        signOutAction={noopSignOutAction}
        logoutPending={state === "logout-pending"}
      />
    </>
  )
}
