import Link from "next/link"
import {
  ArrowRight02Icon,
  Camera01Icon,
  Megaphone01Icon,
} from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  isVenueOperational,
  type LaunchReadiness,
} from "@/lib/merchant/launch-readiness-core"

/**
 * One readiness-driven dashboard action seam shared by the production page and
 * its DB-free harness. First-run venues get one authoritative setup action;
 * live and paused-but-launched venues keep the counter actions their existing
 * members still need.
 */
export function MerchantDashboardHeaderActions({
  readiness,
}: {
  readonly readiness: LaunchReadiness
}) {
  if (!isVenueOperational(readiness)) {
    return (
      <Button asChild className="w-full sm:w-auto">
        <Link href={readiness.nextStep?.href ?? "/app/launch"} prefetch={false}>
          <Icon icon={ArrowRight02Icon} size={16} />
          Finish setup
        </Link>
      </Button>
    )
  }

  // Scanning a reward is the reach-for counter action. `flex-col-reverse`
  // keeps it above the secondary action when buttons stack on a phone, while
  // the desktop row restores the usual primary-rightmost order.
  return (
    <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
      <Button asChild variant="secondary" className="w-full sm:w-auto">
        <Link href="/app/announcements" prefetch={false}>
          <Icon icon={Megaphone01Icon} size={16} />
          Announce
        </Link>
      </Button>
      <Button asChild className="w-full sm:w-auto">
        <Link href="/app/scan" prefetch={false}>
          <Icon icon={Camera01Icon} size={16} />
          Scan reward
        </Link>
      </Button>
    </div>
  )
}
