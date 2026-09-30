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
  // S8: the join worked and only the first stamp did not. Say so plainly,
  // keep the card, and offer the one thing that fixes it.
  switch (recovery.resolution) {
    case "retry":
      return (
        <div className="grid gap-3">
          <StatusBanner title="Your card is saved." tone="warning">
            Your first stamp didn&apos;t go through.
          </StatusBanner>
          <form action={retryJoinFirstStampAction}>
            <input type="hidden" name="membershipId" value={membershipId} />
            <Button type="submit" size="lg" className="w-full">
              Try again
            </Button>
          </form>
        </div>
      )
    case "rescan":
      return (
        <div className="grid gap-3">
          <StatusBanner title="Your card is saved." tone="warning">
            Your first stamp didn&apos;t go through. Scan the QR at the counter
            to add it.
          </StatusBanner>
          <Button asChild size="lg" className="w-full">
            <Link href="/scan">Scan the QR</Link>
          </Button>
        </div>
      )
    case "venue_action":
      return (
        <StatusBanner title="Your card is saved." tone="warning">
          Your first stamp didn&apos;t go through, and this venue isn&apos;t
          adding stamps just now. Ask a team member for help.
        </StatusBanner>
      )
    default:
      return assertNever(recovery.resolution)
  }
}
