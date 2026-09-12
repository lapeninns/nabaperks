import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { getMerchantLaunchReadiness } from "@/lib/merchant/launch-readiness"

/** Shared setup CTA for merchant console routes while launch is incomplete. */
export async function MerchantSetupReminder() {
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
