import { describe, expect, it } from "vitest"

import {
  DEFAULT_STAMPS_REQUIRED,
  MERCHANT_GONE_QUIET_DAYS,
  buildMerchantCustomerReadback,
  deriveMerchantCustomerInitials,
  deriveMerchantCustomerRewardBadge,
  formatHashedPhoneLine,
  formatJoinedDate,
  formatLastVisit,
} from "@/lib/merchant/customer-readback"
import type { MerchantCustomerRow } from "@/lib/merchant/dashboard"

// A fixed "now" in British Summer Time (UTC+1) so London-calendar maths is
// deterministic regardless of the machine clock.
const NOW = new Date("2026-06-16T12:00:00.000Z")

function baseRow(
  overrides: Partial<MerchantCustomerRow> = {}
): MerchantCustomerRow {
  return {
    id: "membership-1",
    current_stamp_count: 1,
    total_stamps_earned: 1,
    total_rewards_redeemed: 0,
    last_visit_at: "2026-06-15T10:00:00.000Z",
    created_at: "2026-06-01T10:00:00.000Z",
    stamps_required: 3,
    customer: { email: "guest@example.test", phone: null, phone_last4: null },
    activeReward: null,
    last_redeemed_at: null,
    ...overrides,
  }
}

describe("merchant customer readback logic", () => {
  describe("deriveMerchantCustomerRewardBadge", () => {
    it("flags an unlocked reward redeemable today as ready and scannable", () => {
      const badge = deriveMerchantCustomerRewardBadge(
        {
          createdAt: "2026-06-01T10:00:00.000Z",
          lastVisitAt: "2026-06-15T10:00:00.000Z",
          currentStampCount: 3,
          stampsRequired: 3,
          lastRedeemedAt: null,
          activeReward: { id: "reward-1", redeemableFrom: "2026-06-16" },
        },
        NOW
      )

      expect(badge).toEqual({
        label: "Reward ready",
        tone: "ready",
        redeemable: true,
      })
    })

    it("flags an unlocked reward not yet redeemable on a full card as waiting", () => {
      const badge = deriveMerchantCustomerRewardBadge(
        {
          createdAt: "2026-06-01T10:00:00.000Z",
          lastVisitAt: "2026-06-15T10:00:00.000Z",
          currentStampCount: 3,
          stampsRequired: 3,
          lastRedeemedAt: null,
          activeReward: { id: "reward-1", redeemableFrom: "2026-06-17" },
        },
        NOW
      )

      expect(badge).toEqual({
        label: "Reward waiting",
        tone: "waiting",
        redeemable: false,
      })
    })

    it("marks a member who joined today (UK) as new", () => {
      const badge = deriveMerchantCustomerRewardBadge(
        {
          createdAt: "2026-06-16T08:30:00.000Z",
          lastVisitAt: "2026-06-16T08:30:00.000Z",
          currentStampCount: 0,
          stampsRequired: 3,
          lastRedeemedAt: null,
          activeReward: null,
        },
        NOW
      )

      expect(badge).toEqual({
        label: "New today",
        tone: "new",
        redeemable: false,
      })
    })

    it("marks a member with no visit for 30+ days as gone quiet", () => {
      const badge = deriveMerchantCustomerRewardBadge(
        {
          createdAt: "2026-01-01T10:00:00.000Z",
          lastVisitAt: "2026-05-01T10:00:00.000Z",
          currentStampCount: 1,
          stampsRequired: 3,
          lastRedeemedAt: null,
          activeReward: null,
        },
        NOW
      )

      expect(badge).toEqual({
        label: "Gone quiet",
        tone: "quiet",
        redeemable: false,
      })
    })

    it("treats a never-visited member as gone quiet", () => {
      const badge = deriveMerchantCustomerRewardBadge(
        {
          createdAt: "2026-01-01T10:00:00.000Z",
          lastVisitAt: null,
          currentStampCount: 0,
          stampsRequired: 3,
          lastRedeemedAt: null,
          activeReward: null,
        },
        NOW
      )

      expect(badge.tone).toBe("quiet")
    })

    it("shows the last redeemed date when there is no active unlock", () => {
      const badge = deriveMerchantCustomerRewardBadge(
        {
          createdAt: "2026-01-01T10:00:00.000Z",
          lastVisitAt: "2026-06-12T10:00:00.000Z",
          currentStampCount: 1,
          stampsRequired: 3,
          lastRedeemedAt: "2026-06-11T09:00:00.000Z",
          activeReward: null,
        },
        NOW
      )

      expect(badge).toEqual({
        label: "Redeemed 11 JUN",
        tone: "redeemed",
        redeemable: false,
      })
    })

    it("falls back to collecting for an active member mid-card", () => {
      const badge = deriveMerchantCustomerRewardBadge(
        {
          createdAt: "2026-05-20T10:00:00.000Z",
          lastVisitAt: "2026-06-14T10:00:00.000Z",
          currentStampCount: 2,
          stampsRequired: 3,
          lastRedeemedAt: null,
          activeReward: null,
        },
        NOW
      )

      expect(badge).toEqual({
        label: "Collecting",
        tone: "collecting",
        redeemable: false,
      })
    })

    it("prioritises a ready reward over the new-today and redeemed states", () => {
      const badge = deriveMerchantCustomerRewardBadge(
        {
          createdAt: "2026-06-16T08:00:00.000Z",
          lastVisitAt: "2026-06-16T08:00:00.000Z",
          currentStampCount: 3,
          stampsRequired: 3,
          lastRedeemedAt: "2026-05-01T09:00:00.000Z",
          activeReward: { id: "reward-1", redeemableFrom: "2026-06-16" },
        },
        NOW
      )

      expect(badge.tone).toBe("ready")
    })
  })

  describe("identity helpers (privacy-safe)", () => {
    it("derives two-letter initials from an email", () => {
      expect(
        deriveMerchantCustomerInitials({
          email: "guest@example.test",
          phone: null,
          phoneLast4: null,
        })
      ).toBe("GE")
    })

    it("derives initials from the phone tail when there is no email", () => {
      expect(
        deriveMerchantCustomerInitials({
          email: null,
          phone: "+447700900048",
          phoneLast4: null,
        })
      ).toBe("48")
    })

    it("returns an empty string when there is nothing safe to show", () => {
      expect(
        deriveMerchantCustomerInitials({
          email: null,
          phone: null,
          phoneLast4: null,
        })
      ).toBe("")
    })

    it("formats a hashed phone line from the last digits", () => {
      expect(
        formatHashedPhoneLine({
          email: null,
          phone: "+447700900048",
          phoneLast4: null,
        })
      ).toBe("07 ··· ··· 48")
    })

    it("uses phone_last4 when the raw phone is absent", () => {
      expect(
        formatHashedPhoneLine({
          email: null,
          phone: null,
          phoneLast4: "0048",
        })
      ).toBe("07 ··· ··· 48")
    })

    it("returns null when there is no phone to hash", () => {
      expect(
        formatHashedPhoneLine({
          email: "g@x.test",
          phone: null,
          phoneLast4: null,
        })
      ).toBeNull()
    })
  })

  describe("UK relative date formatting", () => {
    it("labels today, yesterday, and older join dates", () => {
      expect(formatJoinedDate("2026-06-16T08:00:00.000Z", NOW)).toBe("Today")
      expect(formatJoinedDate("2026-06-15T08:00:00.000Z", NOW)).toBe(
        "Yesterday"
      )
      expect(formatJoinedDate("2026-05-27T08:00:00.000Z", NOW)).toBe("27 May")
    })

    it("labels last visit with time today, yesterday, weekday, or not yet", () => {
      expect(formatLastVisit(null, NOW)).toBe("Not yet")
      expect(formatLastVisit("2026-06-16T10:42:00.000Z", NOW)).toBe(
        "Today 11:42"
      )
      expect(formatLastVisit("2026-06-15T10:00:00.000Z", NOW)).toBe("Yesterday")
      expect(formatLastVisit("2026-06-09T10:00:00.000Z", NOW)).toContain(
        "9 Jun"
      )
    })
  })

  describe("buildMerchantCustomerReadback", () => {
    it("builds a masked-safe view model and never leaks raw identifiers", () => {
      const view = buildMerchantCustomerReadback(
        baseRow({
          customer: {
            email: "guest@example.test",
            phone: "+447700900048",
            phone_last4: "0048",
          },
          current_stamp_count: 3,
          activeReward: { id: "reward-1", redeemable_from: "2026-06-16" },
        }),
        NOW
      )

      expect(view.id).toBe("membership-1")
      expect(view.identifier).toBe("g***@example.test")
      expect(view.initials).toBe("GE")
      expect(view.phoneLine).toBe("07 ··· ··· 48")
      expect(view.joinedLabel).toBe("1 Jun")
      expect(view.currentStampCount).toBe(3)
      expect(view.stampsRequired).toBe(3)
      expect(view.badge.tone).toBe("ready")
      expect(view.scanRewardId).toBe("reward-1")

      const serialised = JSON.stringify(view)
      expect(serialised).not.toContain("guest@example.test")
      expect(serialised).not.toContain("447700900048")
    })

    it("omits the scan id when the reward is not redeemable", () => {
      const view = buildMerchantCustomerReadback(
        baseRow({
          current_stamp_count: 3,
          activeReward: { id: "reward-1", redeemable_from: "2026-06-20" },
        }),
        NOW
      )

      expect(view.badge.tone).toBe("waiting")
      expect(view.scanRewardId).toBeNull()
    })

    it("hides the phone line for phone-only members to avoid duplicating the identifier", () => {
      const view = buildMerchantCustomerReadback(
        baseRow({
          customer: {
            email: null,
            phone: "+447700900048",
            phone_last4: "0048",
          },
        }),
        NOW
      )

      expect(view.identifier).toBe("Phone ending 0048")
      expect(view.phoneLine).toBeNull()
    })
  })

  it("exposes the shared readback constants", () => {
    expect(DEFAULT_STAMPS_REQUIRED).toBe(3)
    expect(MERCHANT_GONE_QUIET_DAYS).toBe(30)
  })
})
