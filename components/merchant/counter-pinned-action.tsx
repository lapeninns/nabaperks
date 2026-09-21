import Link from "next/link"
import { ArrowRight02Icon, Camera01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { ConsolePinnedAction } from "@/components/layout/console-pinned-action"
import { Button } from "@/components/ui/button"
import {
  isVenueOperational,
  type LaunchReadiness,
} from "@/lib/merchant/launch-readiness-core"

/**
 * The Counter's one pinned action, shared by the production page and its
 * DB-free harness. An operational venue gets the scanner (the Counter's
 * second and last accent use); a venue still in setup gets its single true
 * next step instead, so the till never offers a scan that cannot succeed.
 */
export function CounterPinnedAction({
  readiness,
}: {
  readonly readiness: LaunchReadiness
}) {
  if (!isVenueOperational(readiness)) {
    return (
      <ConsolePinnedAction>
        <Button asChild size="lg" className="w-full">
          <Link
            href={readiness.nextStep?.href ?? "/app/launch"}
            prefetch={false}
          >
            <Icon icon={ArrowRight02Icon} size={18} />
            Finish setup
          </Link>
        </Button>
      </ConsolePinnedAction>
    )
  }

  return (
    <ConsolePinnedAction>
      <Button asChild size="lg" className="w-full">
        <Link href="/app/scan" prefetch={false}>
          <Icon icon={Camera01Icon} size={18} />
          Scan a customer code
        </Link>
      </Button>
    </ConsolePinnedAction>
  )
}
