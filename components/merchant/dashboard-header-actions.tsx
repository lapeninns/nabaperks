import Link from "next/link"
import {
  ArrowRight02Icon,
  Camera01Icon,
  DiscountTag01Icon,
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

  // 03#8 removed these on phones entirely (three stacked full-width buttons
  // cost 148px above the first number) on the grounds that the bottom tab bar
  // carries Scan. But merchant-launch-follow-through asserts the counter
  // actions stay inside <main> on the dashboard, and the tab bar is a sibling
  // of main, not part of it — so on mobile-safari the dashboard had no counter
  // action in its own content at all.
  //
  // They are back on phones as ONE wrapping row of compact buttons rather than
  // three stacked full-width ones, which keeps the height saving 03#8 was
  // after. Scan keeps the primary ink and the rightmost (nearest-thumb) slot.
  return (
    <div className="flex flex-wrap gap-2 sm:w-auto">
      <Button asChild variant="ghost" size="sm" className="sm:h-11 sm:px-5">
        <Link href="/app/offers" prefetch={false}>
          <Icon icon={DiscountTag01Icon} size={16} />
          Offers
        </Link>
      </Button>
      <Button asChild variant="secondary" size="sm" className="sm:h-11 sm:px-5">
        <Link href="/app/announcements" prefetch={false}>
          <Icon icon={Megaphone01Icon} size={16} />
          Announce
        </Link>
      </Button>
      <Button asChild size="sm" className="sm:h-11 sm:px-5">
        <Link href="/app/scan" prefetch={false}>
          <Icon icon={Camera01Icon} size={16} />
          Scan code
        </Link>
      </Button>
    </div>
  )
}
