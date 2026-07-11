import Link from "next/link"

import { retryJoinFirstStampAction } from "@/app/card/[membershipId]/actions"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { assertNever } from "@/lib/customer/experience/types"
import type { JoinFirstStampRecovery } from "@/lib/customer/join-first-stamp-recovery"

export function JoinFirstStampRecoveryPanel({
  membershipId,
  recovery,
}: {
  readonly membershipId: string
  readonly recovery: JoinFirstStampRecovery
}) {
  switch (recovery.resolution) {
    case "retry":
      return (
        <div className="grid gap-3">
          <StatusBanner title="Your first stamp is still waiting." tone="warning">
            Your card is saved. Give the stamp one calm retry.
          </StatusBanner>
          <form action={retryJoinFirstStampAction}>
            <input type="hidden" name="membershipId" value={membershipId} />
            <Button type="submit" size="lg" className="w-full">
              Try my first stamp again
            </Button>
          </form>
        </div>
      )
    case "rescan":
      return (
        <div className="grid gap-3">
          <StatusBanner title="Scan the venue QR once more." tone="warning">
            Your card is saved. A fresh venue scan will collect the missing
            stamp.
          </StatusBanner>
          <Button asChild size="lg" variant="secondary" className="w-full">
            <Link href="/scan">Scan the venue QR again</Link>
          </Button>
        </div>
      )
    case "venue_action":
      return (
        <StatusBanner title="Your card is saved." tone="warning">
          This venue is not taking stamps just now. Ask the team before trying
          again.
        </StatusBanner>
      )
    default:
      return assertNever(recovery.resolution)
  }
}
