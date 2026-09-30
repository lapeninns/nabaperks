import { notFound } from "next/navigation"

import { RewardReadyPanel } from "@/components/customer/reward-panels"
import type {
  CustomerExperience,
  ProfileGate,
} from "@/lib/customer/experience/types"

export const dynamic = "force-dynamic"

// `email-send`: the saved email has no code pending, so the email step offers
// to send one instead of asking for it (QA BUG-036). `email-address`: details
// saved, no address yet. `phone`: joined by email, mobile number outstanding.
const GATES = new Set([
  "details",
  "email-address",
  "email-code",
  "email-send",
  "phone",
  "ready",
])

const BASE_REWARD = {
  rewardId: "00000000-0000-4000-8000-000000000001",
  membershipId: "00000000-0000-4000-8000-000000000002",
  rewardName: "A mystery reward",
  rewardTerms: "Ask the team when you collect.",
  redeemableFrom: null,
  availableFrom: null,
  expiresAt: "2026-12-24T15:00:00Z",
  requiresAgeCheck: true,
  earningTerms: "One stamp per visit.",
  inWindow: false,
  windowEndsAt: null,
  upgradeRewardName: null,
  nextWindowStartsAt: null,
  nextWindowEndsAt: null,
  nextWindowUpgradeName: null,
} as const

function profileGate(gate: string): ProfileGate {
  if (gate === "email-code" || gate === "email-send") {
    return {
      complete: false,
      dateOfBirthVerified: false,
      needsEmailVerification: true,
      emailCodePending: gate === "email-code",
      needsPhoneVerification: false,
      fullName: "Alex Regular",
      dateOfBirth: "1990-01-01",
      email: "alex@example.test",
      emailLocked: false,
    }
  }
  if (gate === "phone") {
    return {
      complete: false,
      dateOfBirthVerified: false,
      needsEmailVerification: false,
      needsPhoneVerification: true,
      fullName: "Alex Regular",
      dateOfBirth: "1990-01-01",
      email: "alex@example.test",
      emailLocked: true,
    }
  }
  if (gate === "email-address") {
    return {
      complete: false,
      dateOfBirthVerified: false,
      needsEmailVerification: false,
      needsPhoneVerification: false,
      fullName: "Alex Regular",
      dateOfBirth: "1990-01-01",
      email: null,
      emailLocked: false,
    }
  }
  if (gate === "ready") {
    return {
      complete: true,
      dateOfBirthVerified: true,
      needsEmailVerification: false,
      needsPhoneVerification: false,
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
    needsPhoneVerification: false,
    fullName: null,
    dateOfBirth: null,
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
