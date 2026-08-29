import Link from "next/link"
import { ArrowRight02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"

export const LAUNCH_BILLING_HREF = "/app/launch?tab=billing"

export function LaunchBillingActivationBanner({
  compact = false,
}: {
  compact?: boolean
}) {
  return (
    <StatusBanner tone="success" title="Your account is created.">
      Proceed to billing to activate your venue and start accepting stamps.
      <div className="mt-3">
        <Button
          asChild
          size={compact ? "sm" : "default"}
          className="w-full sm:w-auto"
        >
          <Link href={LAUNCH_BILLING_HREF}>
            Proceed to billing
            <Icon icon={ArrowRight02Icon} size={16} />
          </Link>
        </Button>
      </div>
    </StatusBanner>
  )
}
