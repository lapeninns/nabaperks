import { CustomerCardExperience } from "@/components/customer/customer-card-experience"
import type { CustomerExperience } from "@/lib/customer/experience/types"

import type { StampHarnessCardMode } from "./modes"

const CARD = {
  membershipId: "abcd1234-0000-4000-8000-0000000000c1",
  merchantName: "Old Crown",
  cardName: "Loyalty card",
  total: 5,
} as const

/** A fixture instant a day ahead, so the retry lane is still open. */
function retryUntil(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString()
}

function laneExperience(mode: StampHarnessCardMode): CustomerExperience {
  if (mode === "unmatched-missing" || mode === "unmatched-venue") {
    return {
      kind: "stamp_unmatched",
      problem: mode === "unmatched-missing" ? "missing" : "unmatched",
      ...CARD,
      current: 2,
      stampDates: ["1 Sep", "5 Sep"],
    }
  }
  const resolution =
    mode === "first-stamp-retry"
      ? "retry"
      : mode === "first-stamp-venue"
        ? "venue_action"
        : "rescan"
  return {
    kind: "card_collecting",
    ...CARD,
    current: 0,
    slamIndex: -1,
    reward: "none",
    rewardTerms: "Fixture venue terms. No live stamp is added on this route.",
    rewardRedeemableFrom: null,
    stampDates: [],
    justStamped: false,
    justJoined: true,
    firstStampRecovery: {
      resolution,
      retryUntil: resolution === "retry" ? retryUntil() : null,
      merchantId: "abcd1234-0000-4000-8000-000000000001",
    },
    geoFlagged: false,
    justRedeemed: false,
  }
}

/** The real card surface for stamp outcomes that land on the card page. */
export function StampHarnessCardLane({ mode }: { mode: StampHarnessCardMode }) {
  return (
    <CustomerCardExperience
      experience={laneExperience(mode)}
      offerPasses={[]}
      offerClaimNotice={null}
    />
  )
}
