import "server-only"

import { getLaunchBillingReadiness } from "@/lib/merchant/launch-readiness"
import {
  buildLaunchReadiness,
  needsLaunchBillingActivation,
  resolveLaunchActiveTab,
  resolveLaunchBillingHref,
  resolveRewardsContinueHref,
  type LaunchBilling,
  type LaunchHubTab,
  type LaunchReadiness,
} from "@/lib/merchant/launch-readiness-core"
import {
  hasTransientLaunchParam,
  type LaunchSearchParams,
} from "@/lib/merchant/launch-search-params"
import { resolveLaunchContinueHref } from "@/lib/merchant/launch-tab-advance"
import { getQrSetupFresh, type QrSetup } from "@/lib/merchant/qr-code"

export type LaunchSetupLoad = {
  setup: QrSetup
  billing: LaunchBilling
  readiness: LaunchReadiness
}

/**
 * Load the merchant's QR setup and billing readiness without mutating state.
 * QR creation/reactivation stays behind explicit server actions or post-save
 * reward mutations, so `/app/launch` and `/app/qr` GET renders remain read-only.
 */
export async function loadLaunchSetup(
  merchantId: string
): Promise<LaunchSetupLoad> {
  // Setup and billing are independent (billing only needs the already-resolved
  // merchant id), so fetch them together rather than waterfalling.
  const [initialSetup, billing] = await Promise.all([
    getQrSetupFresh(),
    getLaunchBillingReadiness(merchantId),
  ])

  const setup = initialSetup
  const readiness = buildLaunchReadiness({
    activeCard: setup.activeCard,
    activeRewardPoolItemCount: setup.activeRewardPoolItemCount,
    qrCode: setup.qrCode,
    location: setup.location,
    billing,
  })

  return { setup, billing, readiness }
}

export type LaunchPageModel = LaunchSetupLoad & {
  activeTab: LaunchHubTab
  needsBilling: boolean
  billingHref: string | null
  continueHref: string | null
  rewardsContinueHref: string | null
  transientCleanHref: string | null
}

/**
 * Assemble everything the `/app/launch` route needs to render: the loaded setup
 * and readiness plus the derived tab selection, billing gate, and "continue"
 * affordances. Keeps the route component presentational.
 */
export async function getLaunchPageModel(
  merchantId: string,
  params: LaunchSearchParams
): Promise<LaunchPageModel> {
  const { setup, billing, readiness } = await loadLaunchSetup(merchantId)

  const activeTab = resolveLaunchActiveTab(params.tab, readiness)
  const needsBilling = needsLaunchBillingActivation(readiness)
  const billingHref = resolveLaunchBillingHref(readiness)
  const continueHref = resolveLaunchContinueHref(
    activeTab,
    params,
    readiness.checklist,
    { rewardsReady: readiness.tabs.rewards }
  )
  const rewardsContinueHref = resolveRewardsContinueHref(readiness)
  const transientCleanHref = hasTransientLaunchParam(params)
    ? `/app/launch?tab=${activeTab}`
    : null

  return {
    setup,
    billing,
    readiness,
    activeTab,
    needsBilling,
    billingHref,
    continueHref,
    rewardsContinueHref,
    transientCleanHref,
  }
}
