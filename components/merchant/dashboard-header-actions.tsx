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
  offersEnabled,
}: {
  readonly readiness: LaunchReadiness
  /**
   * Whether this venue is inside the Offers pilot (feature flag AND the venue
   * allowlist). Required rather than defaulted, so a caller cannot silently
   * reintroduce an entry point that leads to a 404.
   */
  readonly offersEnabled: boolean
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
  // keeps it above the secondary actions when buttons stack on a phone, while
  // the desktop row restores the usual primary-rightmost order.
  return (
    <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
      {/* Offers is behind a flag and a per-venue allowlist, and the hub itself
          404s for venues outside the pilot — so the entry point is shown only
          where it leads somewhere, exactly like the sidebar item. */}
      {offersEnabled ? (
        <Button asChild variant="ghost" className="w-full sm:w-auto">
          <Link href="/app/offers" prefetch={false}>
            <Icon icon={DiscountTag01Icon} size={16} />
            Offers
          </Link>
        </Button>
      ) : null}
      <Button asChild variant="secondary" className="w-full sm:w-auto">
        <Link href="/app/announcements" prefetch={false}>
          <Icon icon={Megaphone01Icon} size={16} />
          Announce
        </Link>
      </Button>
      <Button asChild className="w-full sm:w-auto">
        <Link href="/app/scan" prefetch={false}>
          <Icon icon={Camera01Icon} size={16} />
          Scan code
        </Link>
      </Button>
    </div>
  )
}
