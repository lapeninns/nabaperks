import { notFound } from "next/navigation"

import { RewardReadyPanel } from "@/components/customer/reward-panels"
import type {
  CustomerExperience,
  ProfileGate,
} from "@/lib/customer/experience/types"

export const dynamic = "force-dynamic"

const GATES = new Set(["details", "email-code", "ready"])

const BASE_REWARD = {
  rewardId: "00000000-0000-4000-8000-000000000001",
  membershipId: "00000000-0000-4000-8000-000000000002",
  rewardName: "A mystery reward",
  rewardTerms: "Ask the team when you collect.",
  redeemableFrom: null,
} as const

function profileGate(gate: string): ProfileGate {
  if (gate === "email-code") {
    return {
      complete: false,
      dateOfBirthVerified: false,
      needsEmailVerification: true,
      fullName: "Alex Regular",
      dateOfBirth: "1990-01-01",
      email: "alex@example.test",
      emailLocked: false,
    }
  }
  if (gate === "ready") {
    return {
      complete: true,
      dateOfBirthVerified: true,
      needsEmailVerification: false,
      fullName: "Alex Regular",
      dateOfBirth: "1990-01-01",
      email: "alex@example.test",
      emailLocked: true,
    }
  }
  return {
    complete: false,
    dateOfBirthVerified: false,
    needsEmailVerification: false,
    fullName: "Alex Regular",
    dateOfBirth: "1990-01-01",
    email: null,
    emailLocked: false,
  }
}

function experience(
  gate: string
): Extract<CustomerExperience, { kind: "reward_ready" }> {
  return {
    kind: "reward_ready",
    merchantName: "The Test Arms",
    fromCard: true,
    reward: BASE_REWARD,
    location: { requireGeofence: false, geofenceRadiusMeters: 150 },
    profileGate: profileGate(gate),
  }
}

export default async function RedemptionSecondFactorHarness({
  searchParams,
}: {
  searchParams: Promise<{ gate?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()

  const query = await searchParams
  const gate = GATES.has(query.gate ?? "") ? (query.gate as string) : "details"

  return (
    <main className="mx-auto w-full max-w-customer px-4 py-6">
      <RewardReadyPanel exp={experience(gate)} />
    </main>
  )
}
