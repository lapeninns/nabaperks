import type { CustomerRewards } from "@/lib/customer/rewards"

/**
 * DB-free wallet fixtures for the /dev/home-harness rewards lane. Literal only
 * (no Date/now) so the harness is deterministic. Exercises every source: an
 * earned stamp reward, a birthday treat, a merchant-sent gift (each in the
 * ready-for-scan bucket), plus redeemed + expired history.
 */
export const HOME_HARNESS_REWARDS: CustomerRewards = {
  historyPage: 1,
  historyPageCount: 1,
  historyTotal: 2,
  redeemable: [
    {
      rewardId: "rwd_earned",
      membershipId: "mem_1",
      businessName: "Old Crown Girton",
      rewardName: "Free flat white",
      rewardTerms: "Any size, on the house.",
      source: "stamp_cycle",
      redeemableFrom: "2026-07-01",
      expiresAt: null,
      expiredAt: null,
      redeemedAt: null,
      createdAt: "2026-07-01T09:00:00.000Z",
    },
    {
      rewardId: "rwd_birthday",
      membershipId: "mem_1",
      businessName: "Old Crown Girton",
      rewardName: "Birthday fizz",
      rewardTerms: "A glass of prosecco during your birthday month.",
      source: "birthday_month",
      redeemableFrom: "2026-07-01",
      expiresAt: "2026-07-31T22:30:00.000Z",
      expiredAt: null,
      redeemedAt: null,
      createdAt: "2026-07-01T09:00:00.000Z",
    },
    {
      rewardId: "rwd_direct",
      membershipId: "mem_2",
      businessName: "The Anchor",
      rewardName: "Manager's thank-you drink",
      rewardTerms: "A drink on us — thanks for being a regular.",
      source: "merchant_direct",
      redeemableFrom: "2026-07-01",
      expiresAt: "2026-08-15T12:00:00.000Z",
      expiredAt: null,
      redeemedAt: null,
      createdAt: "2026-07-01T09:00:00.000Z",
    },
  ],
  upcoming: [
    {
      rewardId: "rwd_upcoming",
      membershipId: "mem_1",
      businessName: "Old Crown Girton",
      rewardName: "Free pastry",
      rewardTerms: "Pick from the counter selection.",
      source: "stamp_cycle",
      redeemableFrom: "2026-12-24",
      expiresAt: null,
      expiredAt: null,
      redeemedAt: null,
      createdAt: "2026-07-01T09:00:00.000Z",
    },
  ],
  redeemed: [
    {
      rewardId: "rwd_redeemed",
      membershipId: "mem_1",
      businessName: "Old Crown Girton",
      rewardName: "Free coffee",
      rewardTerms: "Any size, on the house.",
      source: "stamp_cycle",
      redeemableFrom: "2026-06-01",
      expiresAt: null,
      expiredAt: null,
      redeemedAt: "2026-06-01T10:00:00.000Z",
      createdAt: "2026-05-25T09:00:00.000Z",
    },
  ],
  expired: [
    {
      rewardId: "rwd_expired",
      membershipId: "mem_1",
      businessName: "Old Crown Girton",
      rewardName: "Last year's fizz",
      rewardTerms: "A glass of prosecco during your birthday month.",
      source: "birthday_month",
      redeemableFrom: "2025-07-01",
      expiresAt: "2025-07-31T22:30:00.000Z",
      expiredAt: "2025-07-31T22:30:00.000Z",
      redeemedAt: null,
      createdAt: "2025-07-01T09:00:00.000Z",
    },
  ],
}
