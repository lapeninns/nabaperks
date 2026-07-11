import { notFound } from "next/navigation"

import { RewardReadyPanel } from "@/components/customer/reward-panels"

export const dynamic = "force-dynamic"

export default function RedemptionSecondFactorHarness() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <main className="mx-auto w-full max-w-customer px-4 py-6">
      <RewardReadyPanel
        exp={{
          kind: "reward_ready",
          merchantName: "The Test Arms",
          fromCard: true,
          reward: {
            rewardId: "00000000-0000-4000-8000-000000000001",
            membershipId: "00000000-0000-4000-8000-000000000002",
            rewardName: "A mystery reward",
            rewardTerms: "Ask the team when you collect.",
            redeemableFrom: null,
          },
          location: { requireGeofence: false, geofenceRadiusMeters: 150 },
          profileGate: {
            complete: false,
            needsEmailVerification: false,
            fullName: "Alex Regular",
            dateOfBirth: "1990-01-01",
            email: null,
            emailLocked: false,
          },
        }}
      />
    </main>
  )
}
