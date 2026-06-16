import { describe, expect, it } from "vitest"

import {
  blockReasonCopy,
  toStampBlockReason,
} from "@/lib/customer/experience/block-reasons"
import {
  getCustomerExperienceViewModel,
  joinWelcomeHref,
  waitingRewardTiming,
} from "@/lib/customer/experience/copy"
import {
  deriveCustomerExperience,
  type CardContext,
  type JoinContext,
  type RewardContext,
  type StampContext,
} from "@/lib/customer/experience/derive"
import { pickByPriority } from "@/lib/customer/experience/priorities"
import {
  assertNever,
  type CustomerExperience,
  type StampBlockReason,
} from "@/lib/customer/experience/types"

const merchant = {
  name: "Bean & Batch",
  slug: "bean-and-batch",
  termsUrl: "/merchant/bean-and-batch/terms",
}
const card = {
  name: "Morning Ritual",
  stampsRequired: 3,
  minSpendPence: 350,
  rewardTerms: "Reveals after the final stamp.",
}
const location = { requireGeofence: false, geofenceRadiusMeters: 150 }
const rewardView = {
  rewardId: "reward-1",
  membershipId: "membership-1",
  rewardName: "Coffee upgrade",
  rewardTerms: "Free size upgrade.",
  minSpendPence: 350,
  redeemableFrom: "2026-06-13",
}

function cardFacts(
  overrides: Partial<Extract<CardContext, { membershipId: string }>> = {}
): CardContext {
  return {
    membershipId: "membership-1",
    merchantName: "Bean & Batch",
    cardName: "Morning Ritual",
    current: 1,
    total: 3,
    reward: null,
    rewardTerms: "Reveals after the final stamp.",
    stampDates: ["14 JUN"],
    justStamped: false,
    justJoined: false,
    geoFlagged: false,
    justRedeemed: false,
    ...overrides,
  }
}

function stampFacts(
  overrides: Partial<Extract<StampContext, { membershipId: string }>> = {}
): StampContext {
  return {
    membershipId: "membership-1",
    merchantName: "Bean & Batch",
    unlockedReward: null,
    alreadyStampedToday: false,
    qrValid: true,
    qrMissing: false,
    qrId: "qr-1",
    location,
    ...overrides,
  }
}

function rewardFacts(
  overrides: Partial<Extract<RewardContext, { reward: unknown }>> = {}
): RewardContext {
  return {
    reward: rewardView,
    merchantName: "Bean & Batch",
    status: "unlocked",
    redeemable: true,
    redeemedProof: false,
    location,
    ...overrides,
  }
}

function joinFacts(
  overrides: Partial<Extract<JoinContext, { merchant: unknown }>> = {}
): JoinContext {
  return {
    merchant,
    card,
    qrId: "qr-1",
    hasSession: false,
    pendingOtp: false,
    membership: null,
    location,
    ...overrides,
  }
}

describe("deriveCustomerExperience — card route", () => {
  it("passes earned stamp dates through to the card grid", () => {
    const exp = deriveCustomerExperience({
      entry: "card",
      context: cardFacts({ stampDates: ["14 JUN", "19 JUN"], current: 2 }),
    })

    expect(exp).toMatchObject({
      kind: "card_collecting",
      current: 2,
      stampDates: ["14 JUN", "19 JUN"],
    })
  })

  it("shows the collecting card with no reward", () => {
    const exp = deriveCustomerExperience({
      entry: "card",
      context: cardFacts(),
    })
    expect(exp).toMatchObject({
      kind: "card_collecting",
      current: 1,
      total: 3,
      reward: "none",
    })
  })

  it("marks a reward waiting when unlocked but not yet redeemable", () => {
    const exp = deriveCustomerExperience({
      entry: "card",
      context: cardFacts({
        current: 3,
        reward: {
          id: "reward-1",
          name: "Coffee upgrade",
          terms: "t",
          minSpendPence: 350,
          redeemableFrom: "2999-01-01",
          redeemable: false,
        },
      }),
    })
    expect(exp).toMatchObject({
      kind: "card_collecting",
      reward: "waiting",
      rewardId: "reward-1",
    })
  })

  it("marks a reward ready when redeemable", () => {
    const exp = deriveCustomerExperience({
      entry: "card",
      context: cardFacts({
        current: 3,
        reward: {
          id: "reward-1",
          name: "Coffee upgrade",
          terms: "t",
          minSpendPence: 350,
          redeemableFrom: "2026-06-01",
          redeemable: true,
        },
      }),
    })
    expect(exp).toMatchObject({
      kind: "card_collecting",
      reward: "ready",
      rewardId: "reward-1",
    })
  })

  it("carries a first-stamp-pending flag when the join stamp was blocked", () => {
    const exp = deriveCustomerExperience({
      entry: "card",
      context: cardFacts({
        current: 0,
        justJoined: true,
        firstStampPending: true,
      }),
    })
    expect(exp).toMatchObject({
      kind: "card_collecting",
      justJoined: true,
      firstStampPending: true,
    })
  })

  it("flags a freshly joined card for the welcome celebration", () => {
    const joined = deriveCustomerExperience({
      entry: "card",
      context: cardFacts({ current: 1, justStamped: true, justJoined: true }),
    })
    const calm = deriveCustomerExperience({
      entry: "card",
      context: cardFacts(),
    })
    expect(joined).toMatchObject({ kind: "card_collecting", justJoined: true })
    expect(calm).toMatchObject({ kind: "card_collecting", justJoined: false })
  })

  it("sets the slam index only on the just-stamped visit", () => {
    const stamped = deriveCustomerExperience({
      entry: "card",
      context: cardFacts({ current: 2, justStamped: true }),
    })
    const calm = deriveCustomerExperience({
      entry: "card",
      context: cardFacts({ current: 2 }),
    })
    expect(stamped).toMatchObject({ kind: "card_collecting", slamIndex: 1 })
    expect(calm).toMatchObject({ kind: "card_collecting", slamIndex: -1 })
  })

  it("shows a safe recovery state when the card is full but no reward exists", () => {
    const exp = deriveCustomerExperience({
      entry: "card",
      context: cardFacts({
        current: 3,
        total: 3,
        reward: null,
        fullWithoutReward: true,
      }),
    })
    expect(exp.kind).toBe("unavailable")
    expect((exp as { reason: string }).reason).toMatch(/sorting your reward/i)
  })

  it("does not invite another stamp on a full card without a reward row", () => {
    const exp = deriveCustomerExperience({
      entry: "card",
      context: cardFacts({
        current: 3,
        total: 3,
        reward: null,
        fullWithoutReward: true,
      }),
    })
    expect(exp.kind).not.toBe("card_collecting")
  })

  it("routes a merchant availability problem to unavailable", () => {
    const exp = deriveCustomerExperience({
      entry: "card",
      context: cardFacts({
        unavailableReason:
          "This merchant loyalty programme is not currently active.",
      }),
    })
    expect(exp).toEqual({
      kind: "unavailable",
      reason: "This merchant loyalty programme is not currently active.",
    })
  })

  it("routes an access problem to unavailable with recovery", () => {
    const exp = deriveCustomerExperience({
      entry: "card",
      context: {
        access: "unauthenticated",
        recovery: { loginHref: "/home/login?next=%2Fcard%2Fmembership-1" },
      },
    })
    expect(exp).toMatchObject({
      kind: "unavailable",
      recovery: { loginHref: "/home/login?next=%2Fcard%2Fmembership-1" },
    })
  })
})

describe("deriveCustomerExperience — stamp route", () => {
  it("confirms a stamp when the QR is valid", () => {
    const exp = deriveCustomerExperience({
      entry: "stamp",
      context: stampFacts(),
    })
    expect(exp).toMatchObject({
      kind: "stamp_confirm",
      membershipId: "membership-1",
      qrId: "qr-1",
    })
  })

  it("prefers the calm already-stamped panel over the confirm screen", () => {
    const exp = deriveCustomerExperience({
      entry: "stamp",
      context: stampFacts({ alreadyStampedToday: true }),
    })
    expect(exp).toMatchObject({
      kind: "card_stamped_today",
      membershipId: "membership-1",
    })
  })

  it("prefers a ready reward over a valid stamp QR", () => {
    const exp = deriveCustomerExperience({
      entry: "stamp",
      context: stampFacts({
        unlockedReward: { ...rewardView, redeemable: true },
      }),
    })
    expect(exp).toMatchObject({
      kind: "reward_ready",
      reward: { rewardId: "reward-1" },
      fromCard: false,
    })
    // The stripped reward view must not leak the redeemable flag.
    expect(exp).not.toHaveProperty("reward.redeemable")
  })

  it("waits on an unlocked-but-not-redeemable reward", () => {
    const exp = deriveCustomerExperience({
      entry: "stamp",
      context: stampFacts({
        unlockedReward: { ...rewardView, redeemable: false },
      }),
    })
    expect(exp).toMatchObject({ kind: "reward_waiting", fromCard: false })
  })

  it("blocks a stamp on a full card with no reward and offers a recovery state", () => {
    const exp = deriveCustomerExperience({
      entry: "stamp",
      context: stampFacts({ fullWithoutReward: true, qrValid: true }),
    })
    expect(exp.kind).toBe("unavailable")
    expect(exp.kind).not.toBe("stamp_confirm")
    expect((exp as { reason: string }).reason).toMatch(/sorting your reward/i)
  })

  it("explains a missing QR as unavailable", () => {
    const exp = deriveCustomerExperience({
      entry: "stamp",
      context: stampFacts({ qrValid: false, qrMissing: true, qrId: undefined }),
    })
    expect(exp).toMatchObject({ kind: "unavailable" })
    expect((exp as { reason: string }).reason).toContain("printed venue QR")
  })

  it("asks the customer to re-scan an invalid QR", () => {
    const exp = deriveCustomerExperience({
      entry: "stamp",
      context: stampFacts({ qrValid: false, qrMissing: false }),
    })
    expect(exp).toMatchObject({ kind: "unavailable" })
    expect((exp as { reason: string }).reason).toContain(
      "Scan the venue code again"
    )
  })

  it("blocks a stamp on a membership owned by another customer", () => {
    const exp = deriveCustomerExperience({
      entry: "stamp",
      context: { access: "unauthorized" },
    })
    expect(exp).toMatchObject({ kind: "unavailable" })
    expect((exp as { reason: string }).reason).toContain("another customer")
  })

  it("blocks a stamp on a membership that cannot be found", () => {
    const exp = deriveCustomerExperience({
      entry: "stamp",
      context: { access: "not_found" },
    })
    expect(exp).toMatchObject({ kind: "unavailable" })
    expect((exp as { reason: string }).reason).toContain("could not be found")
  })
})

describe("deriveCustomerExperience — reward route", () => {
  it("shows the redeemed proof after redemption", () => {
    const exp = deriveCustomerExperience({
      entry: "reward",
      context: rewardFacts({
        redeemedProof: true,
        status: "redeemed",
        redeemable: false,
      }),
    })
    expect(exp).toMatchObject({
      kind: "redeemed_proof",
      reward: { rewardId: "reward-1" },
    })
  })

  it("shows ready reward with the redeem form context", () => {
    const exp = deriveCustomerExperience({
      entry: "reward",
      context: rewardFacts(),
    })
    expect(exp).toMatchObject({ kind: "reward_ready", fromCard: true })
  })

  it("waits on an unlocked reward that is not redeemable yet", () => {
    const exp = deriveCustomerExperience({
      entry: "reward",
      context: rewardFacts({ redeemable: false }),
    })
    expect(exp).toMatchObject({ kind: "reward_waiting", fromCard: true })
  })

  it("routes an unavailable programme to unavailable", () => {
    const exp = deriveCustomerExperience({
      entry: "reward",
      context: rewardFacts({
        redeemable: false,
        status: "cancelled",
        unavailableReason:
          "This loyalty programme is unavailable at the moment.",
      }),
    })
    expect(exp).toMatchObject({
      kind: "unavailable",
      reason: "This loyalty programme is unavailable at the moment.",
    })
  })

  it("blocks a reward owned by another customer", () => {
    const exp = deriveCustomerExperience({
      entry: "reward",
      context: { access: "unauthorized" },
    })
    expect(exp).toMatchObject({ kind: "unavailable" })
    expect((exp as { reason: string }).reason).toContain("another customer")
  })

  it("blocks a reward that cannot be found", () => {
    const exp = deriveCustomerExperience({
      entry: "reward",
      context: { access: "not_found" },
    })
    expect(exp).toMatchObject({ kind: "unavailable" })
    expect((exp as { reason: string }).reason).toContain("could not be found")
  })
})

describe("deriveCustomerExperience — join route", () => {
  it("welcomes a fresh QR scan", () => {
    const exp = deriveCustomerExperience({
      entry: "join",
      context: joinFacts(),
    })
    expect(exp).toMatchObject({ kind: "join_welcome", qrId: "qr-1" })
  })

  it("advances to the phone form when step=phone", () => {
    const exp = deriveCustomerExperience({
      entry: "join",
      context: joinFacts({ step: "phone" }),
    })
    expect(exp).toMatchObject({ kind: "join_phone" })
  })

  it("skips welcome for a direct join with no QR", () => {
    const exp = deriveCustomerExperience({
      entry: "join",
      context: joinFacts({ qrId: undefined }),
    })
    expect(exp).toMatchObject({ kind: "join_phone" })
  })

  it("shows the OTP step while a verification is pending", () => {
    const exp = deriveCustomerExperience({
      entry: "join",
      context: joinFacts({ pendingOtp: true, pendingPhone: "+447400123456" }),
    })
    expect(exp).toMatchObject({
      kind: "join_otp",
      contact: "+447400123456",
    })
  })

  it("asks a verified customer to accept terms", () => {
    const exp = deriveCustomerExperience({
      entry: "join",
      context: joinFacts({ hasSession: true, pendingOtp: false }),
    })
    expect(exp).toMatchObject({ kind: "join_terms" })
  })

  it("sends a returning member to their card", () => {
    const exp = deriveCustomerExperience({
      entry: "join",
      context: joinFacts({
        hasSession: true,
        membership: { id: "membership-1", current: 2 },
      }),
    })
    expect(exp).toMatchObject({
      kind: "join_returning",
      membershipId: "membership-1",
      current: 2,
      total: 3,
    })
  })

  it("shows unavailable when the card cannot be joined", () => {
    const exp = deriveCustomerExperience({
      entry: "join",
      context: { unavailable: true },
    })
    expect(exp).toMatchObject({ kind: "unavailable" })
  })
})

describe("priority tables", () => {
  it("resolves a ready reward ahead of a stamp confirm on the stamp route", () => {
    expect(pickByPriority("stamp", ["stamp_confirm", "reward_ready"])).toBe(
      "reward_ready"
    )
  })

  it("resolves redeemed proof ahead of everything on the reward route", () => {
    expect(pickByPriority("reward", ["reward_ready", "redeemed_proof"])).toBe(
      "redeemed_proof"
    )
  })

  it("returns undefined when no candidate is allowed on the route", () => {
    expect(pickByPriority("card", ["join_phone"])).toBeUndefined()
  })
})

function collectingExp(
  overrides: Partial<
    Extract<CustomerExperience, { kind: "card_collecting" }>
  > = {}
): Extract<CustomerExperience, { kind: "card_collecting" }> {
  return {
    kind: "card_collecting",
    membershipId: "membership-1",
    merchantName: "Bean & Batch",
    cardName: "Morning Ritual",
    current: 1,
    total: 3,
    slamIndex: -1,
    reward: "none",
    rewardTerms: "Reveals after the final stamp.",
    minSpendPence: null,
    rewardRedeemableFrom: null,
    stampDates: [],
    justStamped: false,
    justJoined: false,
    geoFlagged: false,
    justRedeemed: false,
    ...overrides,
  }
}

describe("getCustomerExperienceViewModel", () => {
  it("leads the collecting card with the card name and merchant tag", () => {
    const vm = getCustomerExperienceViewModel(collectingExp())
    expect(vm.eyebrow).toBe("Bean & Batch")
    expect(vm.headline).toBe("Morning Ritual")
    expect(vm.supportLine).toBeUndefined()
  })

  it("welcomes a freshly joined card and carries the card name once", () => {
    const vm = getCustomerExperienceViewModel(
      collectingExp({ justJoined: true, justStamped: true })
    )
    expect(vm.headline).toBe("Welcome to Bean & Batch")
    expect(vm.supportLine).toBe("Morning Ritual")
  })

  it("phrases the already-stamped state calmly with a view-card action", () => {
    const vm = getCustomerExperienceViewModel({
      kind: "card_stamped_today",
      membershipId: "membership-1",
      merchantName: "Bean & Batch",
    })
    expect(vm.headline).toBe("You're stamped for today")
    expect(vm.primaryAction).toEqual({
      label: "View card",
      href: "/card/membership-1",
    })
  })

  it("motivates the phone step with the merchant, stamp count and mystery reward", () => {
    const vm = getCustomerExperienceViewModel({
      kind: "join_phone",
      merchant,
      card,
      qrId: "qr-1",
    })
    expect(vm.supportLine).toContain(merchant.name)
    expect(vm.supportLine).toContain(String(card.stampsRequired))
    expect(vm.supportLine).toContain("mystery reward")
  })

  it("carries the QR through the welcome CTA", () => {
    const vm = getCustomerExperienceViewModel({
      kind: "join_welcome",
      merchant,
      card,
      qrId: "qr-1",
    })
    expect(vm.primaryAction?.href).toBe(
      "/m/bean-and-batch/join?qr=qr-1&step=phone"
    )
  })

  it("returns to the welcome card preview without step=phone", () => {
    expect(joinWelcomeHref("bean-and-batch", "qr-1")).toBe(
      "/m/bean-and-batch/join?qr=qr-1"
    )
  })

  it("offers customer recovery on an unavailable state with recovery", () => {
    const vm = getCustomerExperienceViewModel({
      kind: "unavailable",
      reason: "x",
      recovery: { loginHref: "/home/login?next=%2Fcard%2F1" },
    })
    expect(vm.primaryAction).toEqual({
      label: "Open my cards",
      href: "/home/login?next=%2Fcard%2F1",
    })
  })

  it("covers every experience kind without throwing", () => {
    const samples: CustomerExperience[] = [
      { kind: "join_welcome", merchant, card, qrId: "q" },
      { kind: "join_phone", merchant, card },
      { kind: "join_otp", merchant, card, contact: "+447400123456", location },
      { kind: "join_terms", merchant, card, location },
      {
        kind: "join_returning",
        merchant,
        card,
        membershipId: "m",
        current: 1,
        total: 3,
      },
      {
        kind: "stamp_confirm",
        membershipId: "m",
        merchantName: "x",
        qrId: "q",
        location,
      },
      { kind: "card_stamped_today", membershipId: "m", merchantName: "x" },
      {
        kind: "card_collecting",
        membershipId: "m",
        merchantName: "x",
        cardName: "c",
        current: 1,
        total: 3,
        slamIndex: -1,
        reward: "none",
        rewardTerms: "t",
        minSpendPence: null,
        rewardRedeemableFrom: null,
        stampDates: [],
        justStamped: false,
        justJoined: false,
        geoFlagged: false,
        justRedeemed: false,
      },
      {
        kind: "reward_waiting",
        reward: rewardView,
        merchantName: "x",
        fromCard: true,
      },
      {
        kind: "reward_ready",
        reward: rewardView,
        merchantName: "x",
        location,
        fromCard: true,
        profileGate: {
          complete: true,
          needsEmailVerification: false,
          fullName: null,
          dateOfBirth: null,
          email: null,
        },
      },
      { kind: "redeemed_proof", reward: rewardView, merchantName: "x" },
      { kind: "unavailable", reason: "x" },
    ]
    for (const exp of samples) {
      expect(
        getCustomerExperienceViewModel(exp).headline.length
      ).toBeGreaterThan(0)
    }
  })
})

describe("waitingRewardTiming", () => {
  it("renders the real reopening date instead of promising tomorrow", () => {
    const copy = waitingRewardTiming("2026-06-17")
    expect(copy).toContain("17 JUN")
    expect(copy).not.toMatch(/tomorrow/i)
  })

  it("falls back to the next opening day when no date is known", () => {
    const copy = waitingRewardTiming(null)
    expect(copy).toMatch(/next opening day/i)
    expect(copy).not.toMatch(/tomorrow/i)
  })
})

describe("block reasons", () => {
  it("maps RPC messages to typed reasons", () => {
    expect(
      toStampBlockReason("Stamp already issued for this UK business day")
    ).toBe("already_stamped_today")
    expect(toStampBlockReason("A reward is already ready to redeem")).toBe(
      "reward_ready_first"
    )
    expect(
      toStampBlockReason(
        "Reward is not redeemable until the next UK business day"
      )
    ).toBe("unavailable")
    expect(toStampBlockReason("Authentication required")).toBe(
      "unauthenticated"
    )
    expect(toStampBlockReason("totally unexpected")).toBe("unknown")
  })

  it("maps the stamp rate-limit error to a calm retry reason, never unknown", () => {
    expect(toStampBlockReason("Rate limit exceeded")).toBe("rate_limited")
    expect(blockReasonCopy("rate_limited").length).toBeGreaterThan(0)
    expect(blockReasonCopy("rate_limited")).not.toMatch(/unavailable/i)
  })

  it("maps the reward-pool minimum error to a calm pool reason for both message variants", () => {
    expect(
      toStampBlockReason(
        "At least 3 active reward pool items are required before unlocking a reward"
      )
    ).toBe("pool_unavailable")
    expect(
      toStampBlockReason(
        "At least one active reward pool item is required before unlocking a reward"
      )
    ).toBe("pool_unavailable")
    expect(blockReasonCopy("pool_unavailable").length).toBeGreaterThan(0)
  })

  it("maps verified-customer, ownership, and not-found RPC guards to safe copy", () => {
    expect(toStampBlockReason("Verified customer required")).toBe(
      "unauthenticated"
    )
    expect(toStampBlockReason("Membership ownership required")).toBe(
      "unavailable"
    )
    expect(toStampBlockReason("Membership not found")).toBe("unavailable")
    expect(toStampBlockReason("Reward ownership required")).toBe("unavailable")
  })

  it("maps the cancelled/suspended billing block to unavailable", () => {
    expect(
      toStampBlockReason("This merchant loyalty programme is unavailable")
    ).toBe("unavailable")
    expect(
      toStampBlockReason("This merchant loyalty programme is not active")
    ).toBe("unavailable")
  })

  it("has calm copy for every typed reason", () => {
    const reasons: StampBlockReason[] = [
      "already_stamped_today",
      "reward_ready_first",
      "rate_limited",
      "pool_unavailable",
      "unauthenticated",
      "profile_incomplete",
      "unavailable",
      "unknown",
    ]
    for (const reason of reasons) {
      expect(blockReasonCopy(reason).length).toBeGreaterThan(0)
    }
  })
})

describe("assertNever", () => {
  it("throws when reached at runtime", () => {
    expect(() => assertNever("x" as never)).toThrow()
  })
})
