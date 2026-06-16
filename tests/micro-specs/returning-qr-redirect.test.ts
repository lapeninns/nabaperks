import { afterEach, describe, expect, it, vi } from "vitest"

describe("destinationForReturningQrVisit", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("returns null when the customer has no membership at the merchant", async () => {
    vi.doMock("@/lib/customer/identity", () => ({
      getCurrentCustomer: vi.fn(async () => ({ id: "customer-1" })),
    }))
    vi.doMock("@/lib/customer/join", () => ({
      getMerchantJoinContext: vi.fn(async () => ({
        available: true,
        merchant: { id: "merchant-1", business_slug: "bean-and-batch" },
      })),
      getExistingMembershipForCurrentUser: vi.fn(async () => null),
      getStampQrContextForMembership: vi.fn(),
    }))
    vi.doMock("@/lib/customer/card", () => ({
      getCustomerCardState: vi.fn(),
    }))
    vi.doMock("@/lib/customer/stamp", () => ({
      issueSelfServiceStamp: vi.fn(),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))

    const { destinationForReturningQrVisit } =
      await import("@/lib/customer/returning-qr-redirect")

    await expect(
      destinationForReturningQrVisit("bean-and-batch", "bean-test-qr", {
        issueStamp: true,
      })
    ).resolves.toBeNull()
  })

  it("routes a returning QR visit to stamp confirm without auto-issuing", async () => {
    vi.doMock("@/lib/customer/identity", () => ({
      getCurrentCustomer: vi.fn(async () => ({ id: "customer-1" })),
    }))
    vi.doMock("@/lib/customer/join", () => ({
      getMerchantJoinContext: vi.fn(async () => ({
        available: true,
        merchant: { id: "merchant-1", business_slug: "bean-and-batch" },
      })),
      getExistingMembershipForCurrentUser: vi.fn(async () => ({
        id: "membership-1",
      })),
      getStampQrContextForMembership: vi.fn(),
    }))
    vi.doMock("@/lib/customer/card", () => ({
      getCustomerCardState: vi.fn(),
    }))
    vi.doMock("@/lib/customer/stamp", () => ({
      issueSelfServiceStamp: vi.fn(),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))

    const { destinationForReturningQrVisit } =
      await import("@/lib/customer/returning-qr-redirect")

    await expect(
      destinationForReturningQrVisit("bean-and-batch", "bean-test-qr", {
        issueStamp: false,
      })
    ).resolves.toBe("/card/membership-1/stamp?qr=bean-test-qr")
  })

  it("issues today's stamp after OTP and lands on the card celebration", async () => {
    const issueSelfServiceStamp = vi.fn(async () => ({
      status: "issued",
      stampEventId: "stamp-1",
      newStampCount: 2,
      rewardUnlocked: false,
      geoFlagged: false,
    }))
    const capturePostHogEvent = vi.fn(async () => {})

    vi.doMock("@/lib/customer/identity", () => ({
      getCurrentCustomer: vi.fn(async () => ({ id: "customer-1" })),
    }))
    vi.doMock("@/lib/customer/join", () => ({
      getMerchantJoinContext: vi.fn(async () => ({
        available: true,
        merchant: { id: "merchant-1", business_slug: "bean-and-batch" },
      })),
      getExistingMembershipForCurrentUser: vi.fn(async () => ({
        id: "membership-1",
      })),
      getStampQrContextForMembership: vi.fn(async () => ({
        qrId: "bean-test-qr",
      })),
    }))
    vi.doMock("@/lib/customer/card", () => ({
      getCustomerCardState: vi.fn(async () => ({
        status: "ready",
        latestReward: null,
      })),
    }))
    vi.doMock("@/lib/customer/stamp", () => ({
      issueSelfServiceStamp,
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent,
    }))

    const { destinationForReturningQrVisit } =
      await import("@/lib/customer/returning-qr-redirect")

    await expect(
      destinationForReturningQrVisit("bean-and-batch", "bean-test-qr", {
        issueStamp: true,
      })
    ).resolves.toBe("/card/membership-1?stamp=issued")

    expect(issueSelfServiceStamp).toHaveBeenCalledWith(
      "membership-1",
      undefined
    )
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "stamp_issued",
        membershipId: "membership-1",
      })
    )
  })

  it("passes OTP-captured coordinates into the returning-member stamp issue", async () => {
    const issueSelfServiceStamp = vi.fn(async () => ({
      status: "issued",
      stampEventId: "stamp-1",
      newStampCount: 2,
      rewardUnlocked: false,
      geoFlagged: false,
    }))

    vi.doMock("@/lib/customer/identity", () => ({
      getCurrentCustomer: vi.fn(async () => ({ id: "customer-1" })),
    }))
    vi.doMock("@/lib/customer/join", () => ({
      getMerchantJoinContext: vi.fn(async () => ({
        available: true,
        merchant: { id: "merchant-1", business_slug: "bean-and-batch" },
      })),
      getExistingMembershipForCurrentUser: vi.fn(async () => ({
        id: "membership-1",
      })),
      getStampQrContextForMembership: vi.fn(async () => ({
        qrId: "bean-test-qr",
      })),
    }))
    vi.doMock("@/lib/customer/card", () => ({
      getCustomerCardState: vi.fn(async () => ({
        status: "ready",
        latestReward: null,
      })),
    }))
    vi.doMock("@/lib/customer/stamp", () => ({
      issueSelfServiceStamp,
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))

    const { destinationForReturningQrVisit } =
      await import("@/lib/customer/returning-qr-redirect")

    await destinationForReturningQrVisit("bean-and-batch", "bean-test-qr", {
      issueStamp: true,
      coordinates: { latitude: 51.524, longitude: -0.071 },
    })

    expect(issueSelfServiceStamp).toHaveBeenCalledWith("membership-1", {
      latitude: 51.524,
      longitude: -0.071,
    })
  })

  it("routes a returning member with a ready reward to the reward page after OTP", async () => {
    const issueSelfServiceStamp = vi.fn()

    vi.doMock("@/lib/customer/identity", () => ({
      getCurrentCustomer: vi.fn(async () => ({ id: "customer-1" })),
    }))
    vi.doMock("@/lib/customer/join", () => ({
      getMerchantJoinContext: vi.fn(async () => ({
        available: true,
        merchant: { id: "merchant-1", business_slug: "bean-and-batch" },
      })),
      getExistingMembershipForCurrentUser: vi.fn(async () => ({
        id: "membership-1",
      })),
      getStampQrContextForMembership: vi.fn(async () => ({
        qrId: "bean-test-qr",
      })),
    }))
    vi.doMock("@/lib/customer/card", () => ({
      getCustomerCardState: vi.fn(async () => ({
        status: "ready",
        latestReward: {
          id: "reward-1",
          status: "unlocked",
          redeemable_from: "2026-06-01",
        },
      })),
    }))
    vi.doMock("@/lib/customer/stamp", () => ({ issueSelfServiceStamp }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))

    const { destinationForReturningQrVisit } =
      await import("@/lib/customer/returning-qr-redirect")

    await expect(
      destinationForReturningQrVisit("bean-and-batch", "bean-test-qr", {
        issueStamp: true,
      })
    ).resolves.toBe("/reward/reward-1")
    expect(issueSelfServiceStamp).not.toHaveBeenCalled()
  })

  it("routes a returning member with a waiting reward back to the card after OTP", async () => {
    const issueSelfServiceStamp = vi.fn()

    vi.doMock("@/lib/customer/identity", () => ({
      getCurrentCustomer: vi.fn(async () => ({ id: "customer-1" })),
    }))
    vi.doMock("@/lib/customer/join", () => ({
      getMerchantJoinContext: vi.fn(async () => ({
        available: true,
        merchant: { id: "merchant-1", business_slug: "bean-and-batch" },
      })),
      getExistingMembershipForCurrentUser: vi.fn(async () => ({
        id: "membership-1",
      })),
      getStampQrContextForMembership: vi.fn(async () => ({
        qrId: "bean-test-qr",
      })),
    }))
    vi.doMock("@/lib/customer/card", () => ({
      getCustomerCardState: vi.fn(async () => ({
        status: "ready",
        latestReward: {
          id: "reward-1",
          status: "unlocked",
          redeemable_from: "2999-01-01",
        },
      })),
    }))
    vi.doMock("@/lib/customer/stamp", () => ({ issueSelfServiceStamp }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))

    const { destinationForReturningQrVisit } =
      await import("@/lib/customer/returning-qr-redirect")

    await expect(
      destinationForReturningQrVisit("bean-and-batch", "bean-test-qr", {
        issueStamp: true,
      })
    ).resolves.toBe("/card/membership-1")
    expect(issueSelfServiceStamp).not.toHaveBeenCalled()
  })

  it("degrades to the stamp screen when the auto-issue throws instead of erroring the OTP action", async () => {
    const issueSelfServiceStamp = vi.fn(async () => {
      throw new Error("Unable to issue a stamp: connection reset")
    })

    vi.doMock("@/lib/customer/identity", () => ({
      getCurrentCustomer: vi.fn(async () => ({ id: "customer-1" })),
    }))
    vi.doMock("@/lib/customer/join", () => ({
      getMerchantJoinContext: vi.fn(async () => ({
        available: true,
        merchant: { id: "merchant-1", business_slug: "bean-and-batch" },
      })),
      getExistingMembershipForCurrentUser: vi.fn(async () => ({
        id: "membership-1",
      })),
      getStampQrContextForMembership: vi.fn(async () => ({
        qrId: "bean-test-qr",
      })),
    }))
    vi.doMock("@/lib/customer/card", () => ({
      getCustomerCardState: vi.fn(async () => ({
        status: "ready",
        latestReward: null,
      })),
    }))
    vi.doMock("@/lib/customer/stamp", () => ({ issueSelfServiceStamp }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))

    const { destinationForReturningQrVisit } =
      await import("@/lib/customer/returning-qr-redirect")

    await expect(
      destinationForReturningQrVisit("bean-and-batch", "bean-test-qr", {
        issueStamp: true,
      })
    ).resolves.toBe("/card/membership-1/stamp?qr=bean-test-qr")
  })

  it("routes an already-stamped customer to the stamped-today screen after OTP", async () => {
    const issueSelfServiceStamp = vi.fn(async () => ({
      status: "blocked",
      reason: "You're already stamped today. Come back tomorrow.",
    }))

    vi.doMock("@/lib/customer/identity", () => ({
      getCurrentCustomer: vi.fn(async () => ({ id: "customer-1" })),
    }))
    vi.doMock("@/lib/customer/join", () => ({
      getMerchantJoinContext: vi.fn(async () => ({
        available: true,
        merchant: { id: "merchant-1", business_slug: "bean-and-batch" },
      })),
      getExistingMembershipForCurrentUser: vi.fn(async () => ({
        id: "membership-1",
      })),
      getStampQrContextForMembership: vi.fn(async () => ({
        qrId: "bean-test-qr",
      })),
    }))
    vi.doMock("@/lib/customer/card", () => ({
      getCustomerCardState: vi.fn(async () => ({
        status: "ready",
        latestReward: null,
      })),
    }))
    vi.doMock("@/lib/customer/stamp", () => ({
      issueSelfServiceStamp,
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))

    const { destinationForReturningQrVisit } =
      await import("@/lib/customer/returning-qr-redirect")

    await expect(
      destinationForReturningQrVisit("bean-and-batch", "bean-test-qr", {
        issueStamp: true,
      })
    ).resolves.toBe("/card/membership-1/stamp?qr=bean-test-qr")
  })
})
