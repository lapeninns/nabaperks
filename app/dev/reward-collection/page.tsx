import { notFound } from "next/navigation"

import { CustomerCardExperience } from "@/components/customer/customer-card-experience"
import { renderQrCodePng } from "@/lib/qr/assets"
import type {
  CustomerExperience,
  ProfileGate,
} from "@/lib/customer/experience/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const metadata = {
  title: "Reward collection harness",
  robots: { index: false, follow: false },
}

const REWARD = {
  rewardId: "harness-reward",
  membershipId: "harness-membership",
  rewardName: "A mystery reward",
  rewardTerms:
    "Harness fixture reward. The venue team confirms the eligible item.",
  redeemableFrom: "2026-09-14",
  availableFrom: "2026-09-14T05:00:00Z",
  expiresAt: "2026-11-09T15:00:00Z",
  requiresAgeCheck: true,
  earningTerms: "One stamp per visit.",
  inWindow: false,
  windowEndsAt: null,
  upgradeRewardName: null,
  nextWindowStartsAt: "2026-09-15T12:00:00Z",
  nextWindowEndsAt: "2026-09-15T15:00:00Z",
  nextWindowUpgradeName: "Free starter",
}

const LONG_REWARD = {
  ...REWARD,
  rewardName: "AnExtraordinarilyLongUnbrokenRewardNameForLayoutTesting",
}

/**
 * A display-fixture code, generated here rather than fetched from the protected
 * `/reward/[id]/qr.png` route: the harness has no session and no reward, and a
 * scannable token must never come from a fixture. It encodes a dead address, so
 * scanning it does nothing.
 */
async function fixtureQrSrc(): Promise<string> {
  const png = await renderQrCodePng(
    "https://example.invalid/display-fixture-not-redeemable",
    480
  )
  return `data:image/png;base64,${png.toString("base64")}`
}

const MERCHANT = "Old Crown Girton"
const LONG_MERCHANT = "The extraordinarily long neighbourhood venue name"

/**
 * Collection-stage fixtures, one per gate state the customer layer derives.
 * `details` has nothing saved, `email` has an address awaiting its code,
 * `id-check` is complete but unverified in person, `ready` is fully cleared.
 */
const GATES: Record<string, ProfileGate> = {
  phone: {
    complete: false,
    dateOfBirthVerified: false,
    needsEmailVerification: false,
    needsPhoneVerification: true,
    fullName: "Alex Regular",
    dateOfBirth: "1990-01-01",
    email: "alex@example.test",
    emailLocked: true,
  },
  details: {
    complete: false,
    dateOfBirthVerified: false,
    needsEmailVerification: false,
    fullName: null,
    dateOfBirth: null,
    email: null,
    emailLocked: false,
  },
  "details-verified-email": {
    complete: false,
    dateOfBirthVerified: false,
    needsEmailVerification: false,
    fullName: null,
    dateOfBirth: null,
    email: "alex@example.test",
    emailLocked: true,
  },
  "details-unverified-email": {
    complete: false,
    dateOfBirthVerified: false,
    needsEmailVerification: true,
    fullName: null,
    dateOfBirth: null,
    email: "alex@example.test",
    emailLocked: false,
  },
  email: {
    complete: false,
    dateOfBirthVerified: false,
    needsEmailVerification: true,
    fullName: "Alex Regular",
    dateOfBirth: "1990-01-01",
    email: "alex@example.test",
    emailLocked: false,
  },
  "id-check": {
    complete: true,
    dateOfBirthVerified: false,
    needsEmailVerification: false,
    fullName: "Alex Regular",
    dateOfBirth: "1990-01-01",
    email: "alex@example.test",
    emailLocked: true,
  },
  ready: {
    complete: true,
    dateOfBirthVerified: true,
    needsEmailVerification: false,
    fullName: "Alex Regular",
    dateOfBirth: "1990-01-01",
    email: "alex@example.test",
    emailLocked: true,
  },
}

/**
 * Reward collection harness — the real reward *surface* with no auth or
 * database. It differs from /dev/home-harness/redemption-second-factor on
 * purpose: that one mounts the panel alone to prove the gate withholds the QR,
 * while this one renders the whole screen (shell headline, progress readout and
 * the fixed tab bar) so the collection layout can be measured against a phone
 * viewport. It sits outside the home harness because that layout adds a second
 * wallet shell, which this screen does not have in production.
 *
 * It covers the collection stages (details, email code, photo-ID check, ready
 * code) and the waiting reward's optional early preparation step.
 *
 * `?state=` selects the gate, `?waiting=1` renders the not-yet-open reward and
 * `?prepare=1` its early preparation step, and `?long=1` swaps in overflow
 * fixtures for the venue and reward names.
 */
export default async function RewardCollectionHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<{
    state?: string
    waiting?: string
    prepare?: string
    long?: string
  }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const profileGate = GATES[params.state ?? "ready"] ?? GATES.ready
  const long = params.long === "1"
  const reward = long ? LONG_REWARD : REWARD
  const merchantName = long ? LONG_MERCHANT : MERCHANT

  const experience: CustomerExperience =
    params.waiting === "1"
      ? {
          kind: "reward_waiting",
          reward,
          merchantName,
          fromCard: true,
          profileGate,
          preparing: params.prepare === "1",
        }
      : {
          kind: "reward_ready",
          reward: { ...reward, redeemableFrom: null },
          merchantName,
          location: { requireGeofence: false, geofenceRadiusMeters: 150 },
          fromCard: true,
          profileGate,
        }

  return (
    <CustomerCardExperience
      experience={experience}
      offerPasses={[]}
      offerClaimNotice={null}
      qrSrc={await fixtureQrSrc()}
    />
  )
}
