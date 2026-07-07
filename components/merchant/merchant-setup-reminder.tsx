import { headers } from "next/headers"

import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { getMerchantLaunchReadiness } from "@/lib/merchant/launch-readiness"
import { shouldShowMerchantSetupReminder } from "@/lib/navigation/merchant-shell"
import { readMerchantRequestPath } from "@/lib/navigation/request-path"

/** Shared setup CTA for merchant console routes while launch is incomplete. */
export async function MerchantSetupReminder() {
  const path = readMerchantRequestPath(await headers())

  if (!shouldShowMerchantSetupReminder(path)) {
    return null
  }

  const readiness = await getMerchantLaunchReadiness()

  if (readiness.launchReady) {
    return null
  }

  return (
    <LaunchReadinessPanel
      readiness={readiness}
      variant="compact"
      showHeader={false}
      className="mb-6"
    />
  )
}
