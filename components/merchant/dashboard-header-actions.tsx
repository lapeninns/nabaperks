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

  // Phones get nothing here: three stacked full-width buttons cost 148px above
  // the first number, and all three destinations are one tap away in the
  // console chrome — Scan sits in the bottom tab bar, Offers and Announce in
  // the drawer. From `sm` up the row is horizontal and costs one line, so the
  // shortcuts stay. Scan is the counter action, so it keeps the primary ink and
  // the rightmost (nearest-thumb) slot.
  return (
    <div className="hidden gap-2 sm:flex sm:w-auto">
      <Button asChild variant="ghost">
        <Link href="/app/offers" prefetch={false}>
          <Icon icon={DiscountTag01Icon} size={16} />
          Offers
        </Link>
      </Button>
      <Button asChild variant="secondary">
        <Link href="/app/announcements" prefetch={false}>
          <Icon icon={Megaphone01Icon} size={16} />
          Announce
        </Link>
      </Button>
      <Button asChild>
        <Link href="/app/scan" prefetch={false}>
          <Icon icon={Camera01Icon} size={16} />
          Scan code
        </Link>
      </Button>
    </div>
  )
}
