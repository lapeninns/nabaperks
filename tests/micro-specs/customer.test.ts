import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

function form(values: Record<string, string | boolean>) {
  const data = new FormData()

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value === true ? "on" : String(value))
  }

  return data
}

function redirectMock() {
  return vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  })
}

function collectReactText(value: unknown): string {
  if (value == null || typeof value === "boolean") {
    return ""
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map(collectReactText).join(" ")
  }

  if (typeof value === "object" && "props" in value) {
    const element = value as {
      type?: unknown
      props?: Record<string, unknown>
    }
    const props = element.props
    if (typeof element.type === "function") {
      try {
        const rendered = element.type(props)
        if (!(rendered instanceof Promise)) {
          return collectReactText(rendered)
        }
      } catch {
        // Fall back to static prop traversal for client-only components.
      }
    }

    return collectReactText(
      props
        ? Object.entries(props)
            .filter(([key]) => !["className", "style"].includes(key))
            .map(([, propValue]) => propValue)
        : undefined
    )
  }

  return ""
}

function normalizeText(value: unknown) {
  return collectReactText(value).replace(/\s+/g, " ").trim()
}

function mockCurrentCustomer(id = "customer-1") {
  vi.doMock("@/lib/customer/identity", () => ({
    getCurrentCustomer: vi.fn(async () => ({
      id,
      authUserId: null,
      email: null,
      emailVerifiedAt: null,
      fullName: "Sam Taylor",
      dateOfBirth: "1990-01-01",
      phone: "Phone ending 3456",
      phoneLast4: "3456",
      phoneCountry: "GB",
      createdAt: "2026-06-13T12:00:00.000Z",
    })),
    getOrCreateCustomerByVerifiedPhone: vi.fn(async () => ({
      id,
      authUserId: null,
      email: null,
      phone: "Phone ending 3456",
      phoneLast4: "3456",
      phoneCountry: "GB",
      createdAt: "2026-06-13T12:00:00.000Z",
    })),
  }))
}

describe("03 customer micro-specs", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/customer/join")
    vi.doUnmock("@/lib/customer/card")
    vi.doUnmock("@/lib/customer/reward")
    vi.doUnmock("@/lib/customer/stamp")
    vi.doUnmock("@/lib/customer/identity")
    vi.doUnmock("@/lib/auth/session")
    vi.doUnmock("@/components/customer/join-forms")
    vi.doUnmock("@/components/customer/self-service-forms")
    vi.doUnmock("next/navigation")
  })

  it("preserves customer self-service form and action contracts after the mobile redesign", () => {
    const joinForms = readProjectFile("components/customer/join-forms.tsx")
    const joinOtpForm = readProjectFile("components/customer/join-otp-form.tsx")
    const joinActions = readProjectFile("app/m/[merchantSlug]/join/actions.ts")
    const experience = readProjectFile(
      "components/customer/customer-card-experience.tsx"
    )
    const stampActions = readProjectFile("app/card/[membershipId]/actions.ts")
    const merchantRewardActions = readProjectFile(
      "app/app/rewards/scan/[rewardId]/actions.ts"
    )
    const rewardPanels = readProjectFile(
      "components/customer/reward-panels.tsx"
    )
    const rewardCollectionQr = readProjectFile(
      "components/customer/reward-collection-qr.tsx"
    )
    const selfServiceForms = readProjectFile(
      "components/customer/self-service-forms.tsx"
    )

    for (const field of ["merchantSlug", "qrId", "contact"]) {
      expect(`${joinForms}\n${joinOtpForm}`).toContain(`name="${field}"`)
      expect(joinActions).toContain(`value(formData, "${field}")`)
    }
    expect(joinOtpForm).toContain('name="otp"')
    expect(joinActions).toContain('value(formData, "otp")')

    for (const checkbox of ["loyaltyTerms", "marketingOptIn"]) {
      expect(joinForms).toContain(`name="${checkbox}"`)
      expect(joinActions).toContain(`formData.get("${checkbox}")`)
    }

    expect(experience).toContain("RewardReadyPanel")
    expect(experience).not.toContain("SelfServiceRedeemForm")
    expect(rewardPanels).toContain("RewardCollectionQr")
    expect(rewardCollectionQr).toContain("Merchant scans this QR")
    expect(merchantRewardActions).toContain(
      "confirmMerchantRewardCollectionAction"
    )
    expect(merchantRewardActions).toContain("collectMerchantScannedReward")
    expect(experience).not.toContain(`name="pin"`)

    expect(stampActions).toContain("selfStampAction")
    expect(stampActions).toContain("issueSelfServiceStamp")
    expect(stampActions).toContain("Scan the venue code to add your stamp.")

    for (const field of ["membershipId", "qrId", "latitude", "longitude"]) {
      expect(selfServiceForms).toContain(`name="${field}"`)
    }
    expect(selfServiceForms).toContain("navigator.geolocation")
  })

  it("keeps customer pages mobile-first with loyalty primitives and safe state copy", () => {
    const landingPage = readProjectFile("app/m/[merchantSlug]/page.tsx")
    const joinPage = readProjectFile("app/m/[merchantSlug]/join/page.tsx")
    const cardPage = readProjectFile("app/card/[membershipId]/page.tsx")
    const stampPage = readProjectFile("app/card/[membershipId]/stamp/page.tsx")
    const qrPage = readProjectFile("app/q/[qrId]/page.tsx")
    const termsPage = readProjectFile(
      "app/merchant/[merchantSlug]/terms/page.tsx"
    )
    // Card / stamp / reward routes are thin wrappers; their UI + copy live in the
    // shared experience layer. The join route wraps the join wizard.
    const experience = readProjectFile(
      "components/customer/customer-card-experience.tsx"
    )
    const rewardPanels = readProjectFile(
      "components/customer/reward-panels.tsx"
    )
    const customerTabBar = readProjectFile(
      "components/layout/customer-tab-bar.tsx"
    )
    const joinWizard = readProjectFile("components/customer/join-wizard.tsx")
    const copy = readProjectFile("lib/customer/experience/copy.ts")
    const loadStamp = readProjectFile("lib/customer/experience/load-stamp.ts")

    expect(landingPage).toContain("CustomerFlowShell")
    expect(landingPage).toContain("getMerchantJoinContext")
    expect(landingPage).toContain("No app loyalty")
    expect(landingPage).toContain("`/m/${merchantSlug}/join`")
    expect(landingPage).toContain("CustomerVenueTermsSheet")

    expect(joinPage).toContain("JoinWizard")
    expect(joinWizard).toContain("CustomerFlowShell")
    expect(joinWizard).toContain("CustomerStampCard")
    expect(joinWizard).toContain("This loyalty card is unavailable")
    expect(joinWizard).toContain(
      "Ask a team member for the current loyalty QR."
    )
    expect(copy).toContain("Open your stamp card")

    expect(cardPage).toContain("CustomerCardExperience")
    expect(experience).toContain("CustomerFlowShell")
    expect(experience).toContain("CustomerTabBar")
    expect(experience).toContain("CustomerStampCard")
    expect(experience).toContain("Stamp added.")
    expect(experience).toContain("Scan the venue code to add your stamp.")
    expect(experience).toContain("Open reward QR")
    expect(customerTabBar).toContain('pathname.startsWith("/card/")')
    expect(customerTabBar).toContain('pathname.startsWith("/reward/")')

    expect(experience).toContain("SelfServiceStampForm")
    expect(loadStamp).toContain("getMerchantStampLocationRequirement")
    expect(loadStamp).toContain("isRedeemableFrom")
    expect(stampPage).toContain("/reward/")

    expect(rewardPanels).toContain("RewardTicket")
    expect(rewardPanels).toContain("Give it a day to breathe")
    expect(rewardPanels).toContain("Ready for merchant scan.")
    expect(rewardPanels).toContain("RewardCollectionQr")
    expect(experience).not.toContain("SelfServiceRedeemForm")

    expect(qrPage).toContain("This loyalty card is unavailable")
    expect(qrPage).toContain("Ask a team member for the current loyalty QR.")
    expect(qrPage).toContain("/stamp?qr=")
    expect(qrPage).not.toContain("throw error")

    for (const topic of [
      "Reward",
      "Earning rule",
      "Stamps needed",
      "Minimum spend",
      "Redemption",
      "Exclusions",
      "Fraud and abuse",
      "Merchant contact",
      "Ask the venue team",
      "Privacy notice",
      "next UK business day",
    ]) {
      expect(termsPage).toContain(topic)
    }

    expect(termsPage).not.toContain(["venue", "PIN"].join(" "))
  })

  it("renders the public merchant landing with live card context and mobile CTAs", async () => {
    vi.resetModules()
    vi.doMock("next/navigation", () => ({ notFound: vi.fn() }))
    vi.doMock("@/lib/customer/join", () => ({
      getMerchantJoinContext: vi.fn(async () => ({
        available: true,
        merchant: {
          id: "merchant-1",
          business_name: "Bean & Batch",
          business_slug: "bean-and-batch",
          email: "team@example.test",
          phone: null,
        },
        loyaltyCard: {
          id: "card-1",
          card_name: "Morning visits",
          reward_name: "Mystery reward",
          stamps_required: 3,
          reward_terms: "Pilot reward terms.",
          min_spend_pence: null,
        },
      })),
    }))
    const { default: MerchantRewardsPage } =
      await import("@/app/m/[merchantSlug]/page")

    const output = await MerchantRewardsPage({
      params: Promise.resolve({ merchantSlug: "bean-and-batch" }),
    })
    const renderedText = normalizeText(output)

    expect(renderedText).toContain("Collect your stamp")
    expect(renderedText).toContain("Morning visits")
    expect(renderedText).toContain("3")
    expect(renderedText).toContain("Collect my stamp")
    expect(renderedText).toContain("View reward terms")
  })

  it("renders returning-member join state with progress and an onward card path", async () => {
    vi.resetModules()
    vi.doMock("@/components/customer/join-forms", () => ({
      CustomerIdentityForm: () => null,
      CustomerJoinForm: () => null,
    }))
    mockCurrentCustomer()
    vi.doMock("@/lib/customer/join", () => ({
      getMerchantJoinContext: vi.fn(async () => ({
        available: true,
        merchant: {
          id: "merchant-1",
          business_name: "Bean & Batch",
          business_slug: "bean-and-batch",
          email: "team@example.test",
          phone: null,
        },
        loyaltyCard: {
          id: "card-1",
          card_name: "Morning visits",
          reward_name: "Mystery reward",
          stamps_required: 3,
          reward_terms: "Pilot reward terms.",
          min_spend_pence: 250,
        },
      })),
      getExistingMembershipForCurrentUser: vi.fn(async () => ({
        id: "membership-1",
        current_stamp_count: 2,
        total_rewards_redeemed: 0,
      })),
    }))
    const { default: MerchantJoinPage } =
      await import("@/app/m/[merchantSlug]/join/page")

    const output = await MerchantJoinPage({
      params: Promise.resolve({ merchantSlug: "bean-and-batch" }),
      searchParams: Promise.resolve({ membership: "existing" }),
    })
    const renderedText = normalizeText(output)

    expect(renderedText).toContain("Morning visits")
    expect(renderedText).toContain("2")
    expect(renderedText).toContain("3")
    expect(renderedText).toContain("Open your stamp card")
  })

  it("renders card and reward status messaging without exposing unsafe mutation controls", async () => {
    vi.resetModules()
    vi.doMock("@/lib/customer/card", () => ({
      getMembershipStampDisplayDates: vi.fn(async () => []),
      reconcileCardStampCount: vi.fn(
        ({ membershipCount }: { membershipCount: number }) => membershipCount
      ),
      getCustomerCardState: vi.fn(async () => ({
        status: "ready",
        membership: {
          id: "membership-1",
          current_stamp_count: 2,
          total_rewards_redeemed: 0,
        },
        merchant: {
          id: "merchant-1",
          business_name: "Bean & Batch",
          business_slug: "bean-and-batch",
          status: "active",
        },
        loyaltyCard: {
          card_name: "Morning visits",
          stamps_required: 3,
          reward_name: "Mystery reward",
          reward_terms: "Reveals after the final stamp.",
          min_spend_pence: null,
          is_active: true,
        },
        latestReward: null,
        billingStatus: "active",
      })),
    }))
    const { default: CustomerCardPage } =
      await import("@/app/card/[membershipId]/page")

    const cardOutput = await CustomerCardPage({
      params: Promise.resolve({ membershipId: "membership-1" }),
      searchParams: Promise.resolve({ stamp: "issued" }),
    })
    const cardText = normalizeText(cardOutput)

    expect(cardText).toContain("Stamp added.")
    expect(cardText).toContain("2")
    expect(cardText).toContain("3")
    expect(cardText).toContain("Mystery reward")
    // A freshly issued stamp confirms itself — it must not also prompt another
    // scan, which read as a failure (audit: success/scan contradiction).
    expect(cardText).toContain("Stamp secured.")
    expect(cardText).not.toContain("Scan the venue code to add your stamp.")

    vi.resetModules()
    vi.doMock("@/lib/customer/stamp", () => ({
      getRewardLocationRequirement: vi.fn(async () => ({
        requireGeofence: false,
        geofenceRadiusMeters: 150,
      })),
    }))
    vi.doMock("@/lib/customer/reward", () => ({
      getCustomerRewardState: vi.fn(async () => ({
        status: "ready",
        reward: {
          id: "reward-1",
          status: "unlocked",
          membership_id: "membership-1",
          created_at: "2026-06-06T12:00:00Z",
          redeemed_at: null,
          reward_name: "Cake slice",
          reward_terms: "Valid on one slice.",
          min_spend_pence: 500,
          redeemable_from: "2999-06-08",
        },
        assignedReward: {
          reward_name: "Cake slice",
          reward_terms: "Valid on one slice.",
          min_spend_pence: 500,
          redeemable_from: "2999-06-08",
        },
        membership: { current_stamp_count: 3, total_rewards_redeemed: 0 },
        merchant: {
          business_name: "Bean & Batch",
          business_slug: "bean-and-batch",
          status: "active",
        },
        loyaltyCard: {
          card_name: "Morning visits",
          stamps_required: 3,
          reward_name: "Mystery reward",
          reward_terms: "Reveals after final stamp.",
          min_spend_pence: null,
          is_active: true,
        },
        billingStatus: "active",
      })),
    }))
    const { default: RewardPage } = await import("@/app/reward/[rewardId]/page")
    const rewardOutput = await RewardPage({
      params: Promise.resolve({ rewardId: "reward-1" }),
      searchParams: Promise.resolve({}),
    })
    const rewardText = normalizeText(rewardOutput)

    expect(rewardText).toContain("Cake slice")
    expect(rewardText).toContain("Give it a day to breathe")
    expect(rewardText).toContain("Return to card")
    expect(rewardText).not.toContain("Redeem reward")
  })

  it("renders merchant-specific terms with the safe contact fallback", async () => {
    vi.resetModules()
    vi.doMock("next/navigation", () => ({ notFound: vi.fn() }))
    vi.doMock("@/lib/customer/join", () => ({
      getMerchantJoinContext: vi.fn(async () => ({
        available: true,
        merchant: {
          id: "merchant-1",
          business_name: "Bean & Batch",
          business_slug: "bean-and-batch",
          email: "",
          phone: null,
        },
        loyaltyCard: {
          id: "card-1",
          card_name: "Morning visits",
          reward_name: "Mystery reward",
          stamps_required: 3,
          reward_terms: "No extra exclusions.",
          min_spend_pence: null,
        },
      })),
    }))
    const { default: MerchantTermsPage } =
      await import("@/app/merchant/[merchantSlug]/terms/page")

    const output = await MerchantTermsPage({
      params: Promise.resolve({ merchantSlug: "bean-and-batch" }),
    })
    const renderedText = normalizeText(output)

    expect(renderedText).toContain("Bean & Batch loyalty terms")
    expect(renderedText).toContain("Ask the venue team")
    expect(renderedText).toContain("Close")
    expect(renderedText).toContain("Privacy notice")

    expect(renderedText).not.toContain("Join rewards")
    expect(renderedText).not.toContain(["venue", "PIN"].join(" "))
    expect(renderedText).toContain("Tap redeem from your reward page")
  })

  it("rejects invalid customer identity input before sending OTP", async () => {
    vi.resetModules()
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("next/headers", () => ({
      headers: vi.fn(async () => new Headers({ "x-vercel-ip-country": "GB" })),
    }))
    vi.doMock("@/lib/security/rate-limit", () => {
      class RateLimitError extends Error {}

      return {
        enforceRateLimit: vi.fn(async () => undefined),
        RateLimitError,
      }
    })
    vi.doMock("@/lib/customer/verification", () => ({
      checkCustomerPhoneVerification: vi.fn(),
      startCustomerPhoneVerification: vi.fn(),
    }))
    vi.doMock("@/lib/customer/session", () => ({
      clearPendingPhoneVerification: vi.fn(),
      getPendingPhoneVerification: vi.fn(),
      setCustomerSession: vi.fn(),
      setPendingPhoneVerification: vi.fn(),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => createSupabaseMock().client),
    }))
    mockCurrentCustomer()
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { requestCustomerIdentityAction } =
      await import("@/app/m/[merchantSlug]/join/actions")

    await expect(
      requestCustomerIdentityAction(
        {},
        form({ contact: "not-contact", merchantSlug: "the-bell", qrId: "qr-1" })
      )
    ).resolves.toMatchObject({
      errors: { contact: "Enter a valid phone number." },
    })
  })

  it("rejects email identity because customer join is phone-only", async () => {
    vi.resetModules()
    const startCustomerPhoneVerification = vi.fn()
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("next/headers", () => ({
      headers: vi.fn(async () => new Headers({ "x-vercel-ip-country": "GB" })),
    }))
    vi.doMock("@/lib/customer/verification", () => ({
      checkCustomerPhoneVerification: vi.fn(),
      startCustomerPhoneVerification,
    }))
    vi.doMock("@/lib/customer/session", () => ({
      clearPendingPhoneVerification: vi.fn(),
      getPendingPhoneVerification: vi.fn(),
      setCustomerSession: vi.fn(),
      setPendingPhoneVerification: vi.fn(),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => createSupabaseMock().client),
    }))
    mockCurrentCustomer()
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { requestCustomerIdentityAction } =
      await import("@/app/m/[merchantSlug]/join/actions")

    await expect(
      requestCustomerIdentityAction(
        {},
        form({
          contact: "Guest@Example.TEST",
          merchantSlug: "the-bell",
          qrId: "qr-public",
        })
      )
    ).resolves.toMatchObject({
      errors: { contact: "Enter a valid phone number." },
    })
    expect(startCustomerPhoneVerification).not.toHaveBeenCalled()
  })

  it("normalizes a UK mobile to E.164 before starting Twilio Verify", async () => {
    vi.resetModules()
    const startCustomerPhoneVerification = vi.fn(async () => ({
      status: "sent",
    }))
    const setPendingPhoneVerification = vi.fn(async () => {})
    const redirect = redirectMock()
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("next/headers", () => ({
      headers: vi.fn(async () => new Headers({ "x-vercel-ip-country": "GB" })),
    }))
    vi.doMock("@/lib/security/rate-limit", () => {
      class RateLimitError extends Error {}

      return {
        enforceRateLimit: vi.fn(async () => undefined),
        RateLimitError,
      }
    })
    vi.doMock("@/lib/customer/verification", () => ({
      checkCustomerPhoneVerification: vi.fn(),
      startCustomerPhoneVerification,
    }))
    vi.doMock("@/lib/customer/session", () => ({
      clearPendingPhoneVerification: vi.fn(),
      getPendingPhoneVerification: vi.fn(),
      setCustomerSession: vi.fn(),
      setPendingPhoneVerification,
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => createSupabaseMock().client),
    }))
    mockCurrentCustomer()
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { requestCustomerIdentityAction } =
      await import("@/app/m/[merchantSlug]/join/actions")

    await expect(
      requestCustomerIdentityAction(
        {},
        form({
          contact: "07400 123456",
          merchantSlug: "the-bell",
          qrId: "qr-public",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/m/the-bell/join?qr=qr-public")
    expect(startCustomerPhoneVerification).toHaveBeenCalledWith("+447400123456")
    expect(setPendingPhoneVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "join",
        phone: "+447400123456",
        country: "GB",
      })
    )
  })

  it("requires verified identity and loyalty terms before joining rewards", async () => {
    vi.resetModules()
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/customer/identity", () => ({
      getCurrentCustomer: vi.fn(async () => null),
      getOrCreateCustomerByVerifiedPhone: vi.fn(),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => createSupabaseMock().client),
    }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://nabaperks.test" }),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { joinRewardsAction } =
      await import("@/app/m/[merchantSlug]/join/actions")

    await expect(
      joinRewardsAction({}, form({ merchantSlug: "the-bell" }))
    ).resolves.toEqual({
      errors: { form: "Verify your phone before joining." },
    })
  })

  it("creates a membership with separate marketing consent and redirects to the digital card", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    const capturePostHogEvent = vi.fn()
    const supabase = createSupabaseMock({
      rpc: {
        join_customer_membership_with_first_stamp: [
          {
            data: [
              {
                membership_id: "membership-1",
                created_membership: true,
                first_stamp_issued: true,
                new_stamp_count: 1,
                reward_unlocked: false,
                geo_flagged: false,
              },
            ],
            error: null,
          },
        ],
      },
    })
    vi.doMock("next/navigation", () => ({ redirect }))
    mockCurrentCustomer()
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://nabaperks.test" }),
    }))
    vi.doMock("@/lib/analytics/events", () => ({ capturePostHogEvent }))
    const { joinRewardsAction } =
      await import("@/app/m/[merchantSlug]/join/actions")

    await expect(
      joinRewardsAction(
        {},
        form({
          merchantSlug: "the-bell",
          qrId: "qr-public",
          loyaltyTerms: true,
          marketingOptIn: true,
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/card/membership-1?welcome=1&stamp=issued")
    expect(supabase.rpcCalls[0]).toEqual({
      name: "join_customer_membership_with_first_stamp",
      params: {
        p_customer_id: "customer-1",
        p_merchant_slug: "the-bell",
        p_qr_id: "qr-public",
        p_marketing_opt_in: true,
        p_policy_version: "2026-06-06",
        p_latitude: null,
        p_longitude: null,
      },
    })
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "customer_joined",
        membershipId: "membership-1",
        actorId: "customer-1",
        metadata: {
          merchant_slug: "the-bell",
          marketing_opt_in: true,
        },
      })
    )
  })

  it("maps join membership backend failures to safe customer copy", async () => {
    vi.resetModules()
    const capturePostHogEvent = vi.fn()
    const supabase = createSupabaseMock({
      rpc: {
        join_customer_membership_with_first_stamp: [
          {
            data: null,
            error: { message: "internal Supabase policy detail" },
          },
        ],
      },
    })
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    mockCurrentCustomer()
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent,
    }))
    const { joinRewardsAction } =
      await import("@/app/m/[merchantSlug]/join/actions")

    await expect(
      joinRewardsAction(
        {},
        form({
          merchantSlug: "the-bell",
          qrId: "qr-public",
          loyaltyTerms: true,
          marketingOptIn: false,
        })
      )
    ).resolves.toEqual({
      errors: {
        form: "Rewards could not be joined. Try again or ask the venue team.",
      },
    })
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "join_terms_accepted",
        actorType: "customer",
        actorId: "customer-1",
        metadata: expect.objectContaining({
          merchant_slug: "the-bell",
          qr_id: "qr-public",
          step: "terms",
          marketing_opt_in: false,
        }),
      })
    )
  })

  it("resolves a QR join context as unavailable when billing is suspended", async () => {
    vi.resetModules()
    const recordProductEvent = vi.fn()
    const supabase = createSupabaseMock({
      from: {
        qr_codes: [
          {
            data: {
              id: "qr-row-1",
              qr_id: "qr-public",
              is_active: true,
              destination_type: "join",
              merchants: {
                id: "merchant-1",
                business_name: "The Bell",
                business_slug: "the-bell",
                email: "owner@example.test",
                phone: null,
              },
              loyalty_cards: {
                id: "card-1",
                card_name: "Mystery Visit Card",
                reward_name: "Surprise reward",
                stamps_required: 3,
                reward_terms: "Reward reveals after three visits.",
                min_spend_pence: null,
                is_active: true,
              },
            },
            error: null,
          },
        ],
        billing_customers: [{ data: { status: "suspended" }, error: null }],
      },
    })
    vi.doMock("@/lib/security/rate-limit", async () => {
      const actual = await vi.importActual<
        typeof import("@/lib/security/rate-limit")
      >("@/lib/security/rate-limit")
      return actual
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }))
    vi.doMock("@/lib/analytics/events", () => ({ recordProductEvent }))
    const { resolveQrForJoin } = await import("@/lib/customer/join")

    await expect(resolveQrForJoin("qr-public")).resolves.toMatchObject({
      available: false,
      merchant: { business_slug: "the-bell" },
      loyaltyCard: { card_name: "Mystery Visit Card" },
    })
    expect(recordProductEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "qr_scanned",
        merchantId: "merchant-1",
        qrCodeId: "qr-row-1",
        metadata: expect.objectContaining({ available: false }),
      })
    )
  })

  it("keeps merchant QR enable/disable coupled to public QR availability", async () => {
    vi.resetModules()
    const recordProductEvent = vi.fn()
    const baseQr = {
      id: "qr-row-1",
      qr_id: "qr-public",
      destination_type: "join",
      merchants: {
        id: "merchant-1",
        business_name: "The Bell",
        business_slug: "the-bell",
        email: "owner@example.test",
        phone: null,
      },
      loyalty_cards: {
        id: "card-1",
        card_name: "Mystery Visit Card",
        reward_name: "Surprise reward",
        stamps_required: 3,
        reward_terms: "Reward reveals after three visits.",
        min_spend_pence: null,
        is_active: true,
      },
    }
    const supabase = createSupabaseMock({
      from: {
        qr_codes: [
          { data: { ...baseQr, is_active: false }, error: null },
          { data: { ...baseQr, is_active: true }, error: null },
        ],
        billing_customers: [
          { data: { status: "active" }, error: null },
          { data: { status: "active" }, error: null },
        ],
      },
    })
    vi.doMock("@/lib/security/rate-limit", async () => {
      const actual = await vi.importActual<
        typeof import("@/lib/security/rate-limit")
      >("@/lib/security/rate-limit")
      return actual
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }))
    vi.doMock("@/lib/analytics/events", () => ({ recordProductEvent }))
    const { resolveQrForJoin } = await import("@/lib/customer/join")

    await expect(resolveQrForJoin("qr-public")).resolves.toMatchObject({
      available: false,
      qrId: "qr-public",
    })
    await expect(resolveQrForJoin("qr-public")).resolves.toMatchObject({
      available: true,
      qrId: "qr-public",
      merchant: { business_slug: "the-bell" },
    })

    expect(recordProductEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        eventName: "qr_scanned",
        qrCodeId: "qr-row-1",
        metadata: expect.objectContaining({ available: false }),
      })
    )
    expect(recordProductEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventName: "qr_scanned",
        qrCodeId: "qr-row-1",
        metadata: expect.objectContaining({ available: true }),
      })
    )
  })

  it("records QR scan analytics at the public resolver without double-counting the join page", async () => {
    vi.resetModules()
    const recordProductEvent = vi.fn()
    const qrData = {
      id: "qr-row-1",
      qr_id: "qr-public",
      is_active: true,
      destination_type: "join",
      merchants: {
        id: "merchant-1",
        business_name: "The Bell",
        business_slug: "the-bell",
        email: "owner@example.test",
        phone: null,
      },
      loyalty_cards: {
        id: "card-1",
        card_name: "Mystery Visit Card",
        reward_name: "Surprise reward",
        stamps_required: 3,
        reward_terms: "Reward reveals after three visits.",
        min_spend_pence: null,
        is_active: true,
      },
    }
    const supabase = createSupabaseMock({
      from: {
        qr_codes: [
          { data: qrData, error: null },
          { data: qrData, error: null },
        ],
        billing_customers: [
          { data: { status: "active" }, error: null },
          { data: { status: "active" }, error: null },
        ],
      },
    })
    vi.doMock("@/lib/security/rate-limit", async () => {
      const actual = await vi.importActual<
        typeof import("@/lib/security/rate-limit")
      >("@/lib/security/rate-limit")
      return actual
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }))
    vi.doMock("@/lib/analytics/events", () => ({ recordProductEvent }))
    const { getMerchantJoinContext, resolveQrForJoin } =
      await import("@/lib/customer/join")

    await expect(resolveQrForJoin("qr-public")).resolves.toMatchObject({
      available: true,
      qrId: "qr-public",
    })
    await expect(
      getMerchantJoinContext("the-bell", "qr-public")
    ).resolves.toMatchObject({
      available: true,
      qrId: "qr-public",
      merchant: { business_slug: "the-bell" },
    })

    expect(recordProductEvent).toHaveBeenCalledTimes(1)
    expect(recordProductEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "qr_scanned",
        qrCodeId: "qr-row-1",
      })
    )
  })

  it("enforces rate limits through the durable Supabase RPC with hashed bucket keys", async () => {
    vi.resetModules()
    vi.doUnmock("@/lib/security/rate-limit")
    vi.doUnmock("@/lib/supabase/server")
    const supabase = createSupabaseMock({
      rpc: { enforce_rate_limit: [{ data: null, error: null }] },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { enforceRateLimit } = await import("@/lib/security/rate-limit")

    await enforceRateLimit({
      key: "customer-identity:guest@example.test",
      limit: 5,
      windowMs: 900_000,
    })

    expect(supabase.rpcCalls[0]).toEqual({
      name: "enforce_rate_limit",
      params: {
        p_bucket_key:
          "57f9d165f63ca9a7f344045ec1ad4e8ec899899cfed8272b90a6db54d2a38734",
        p_limit: 5,
        p_window_ms: 900_000,
      },
    })
  })

  it("returns only the owning customer digital card with persisted mystery reward state", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        customer_memberships: [
          {
            data: {
              id: "membership-1",
              merchant_id: "merchant-1",
              customer_id: "customer-1",
              current_stamp_count: 3,
              total_rewards_redeemed: 1,
              merchants: {
                business_name: "The Bell",
                business_slug: "the-bell",
                status: "active",
              },
            },
            error: null,
          },
        ],
        loyalty_cards: [
          {
            data: {
              card_name: "Mystery Visit Card",
              stamps_required: 3,
              reward_name: "Surprise reward",
              reward_terms:
                "Complete 3 visits to reveal a surprise reward. Redeem from the next UK business day.",
              min_spend_pence: null,
              is_active: true,
            },
            error: null,
          },
        ],
        reward_events: [
          {
            data: {
              id: "reward-1",
              status: "unlocked",
              reward_name: "Coffee upgrade",
              reward_terms: "Valid on one hot drink.",
              min_spend_pence: 250,
              redeemable_from: "2026-06-08",
            },
            error: null,
          },
        ],
        billing_customers: [{ data: { status: "active" }, error: null }],
      },
    })
    mockCurrentCustomer()
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getCustomerCardState } = await import("@/lib/customer/card")

    await expect(getCustomerCardState("membership-1")).resolves.toMatchObject({
      status: "ready",
      membership: { current_stamp_count: 3 },
      loyaltyCard: { reward_name: "Surprise reward" },
      latestReward: {
        id: "reward-1",
        status: "unlocked",
        reward_name: "Coffee upgrade",
        redeemable_from: "2026-06-08",
      },
    })
  })

  it("hides redeemed rewards when a new stamp cycle has started", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        customer_memberships: [
          {
            data: {
              id: "membership-1",
              merchant_id: "merchant-1",
              customer_id: "customer-1",
              current_stamp_count: 0,
              total_rewards_redeemed: 1,
              merchants: {
                business_name: "The Bell",
                business_slug: "the-bell",
                status: "active",
              },
            },
            error: null,
          },
        ],
        loyalty_cards: [
          {
            data: {
              card_name: "Mystery Visit Card",
              stamps_required: 3,
              reward_name: "Surprise reward",
              reward_terms:
                "Complete 3 visits to reveal a surprise reward. Redeem from the next UK business day.",
              min_spend_pence: null,
              is_active: true,
            },
            error: null,
          },
        ],
        reward_events: [{ data: null, error: null }],
        billing_customers: [{ data: { status: "active" }, error: null }],
      },
    })
    mockCurrentCustomer()
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getCustomerCardState } = await import("@/lib/customer/card")

    await expect(getCustomerCardState("membership-1")).resolves.toMatchObject({
      status: "ready",
      membership: { current_stamp_count: 0, total_rewards_redeemed: 1 },
      latestReward: null,
    })
    expect(supabase.queryCalls).toContainEqual({
      table: "reward_events",
      method: "eq",
      args: ["status", "unlocked"],
    })
  })

  it("returns only the owning customer reward redemption state using assigned reward details", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        reward_events: [
          {
            data: {
              id: "reward-1",
              status: "unlocked",
              membership_id: "membership-1",
              merchant_id: "merchant-1",
              customer_id: "customer-1",
              created_at: "2026-06-06T12:00:00.000Z",
              redeemed_at: null,
              reward_name: "Cake slice",
              reward_terms:
                "Valid on one cake slice from the next business day.",
              min_spend_pence: 500,
              redeemable_from: "2026-06-08",
              customer_memberships: {
                current_stamp_count: 3,
                total_rewards_redeemed: 0,
              },
              merchants: {
                business_name: "The Bell",
                business_slug: "the-bell",
                status: "active",
              },
              loyalty_cards: {
                card_name: "Mystery Visit Card",
                stamps_required: 3,
                reward_name: "Surprise reward",
                reward_terms:
                  "Complete 3 visits to reveal a surprise reward. Redeem from the next UK business day.",
                min_spend_pence: null,
                is_active: true,
              },
            },
            error: null,
          },
        ],
        billing_customers: [{ data: { status: "active" }, error: null }],
      },
    })
    mockCurrentCustomer()
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getCustomerRewardState } = await import("@/lib/customer/reward")

    await expect(getCustomerRewardState("reward-1")).resolves.toMatchObject({
      status: "ready",
      reward: {
        id: "reward-1",
        status: "unlocked",
        reward_name: "Cake slice",
        redeemable_from: "2026-06-08",
      },
      membership: { current_stamp_count: 3 },
      assignedReward: {
        reward_name: "Cake slice",
        min_spend_pence: 500,
      },
      loyaltyCard: { reward_name: "Surprise reward" },
    })
  })
})

describe("normalizeUkPhone", () => {
  it("converts the UK shapes customers type into E.164", async () => {
    const { normalizeUkPhone } = await import("@/lib/customer/phone")

    expect(normalizeUkPhone("07400123456")).toBe("+447400123456")
    expect(normalizeUkPhone("07400 123 456")).toBe("+447400123456")
    expect(normalizeUkPhone("(07400) 123-456")).toBe("+447400123456")
    expect(normalizeUkPhone("447400123456")).toBe("+447400123456")
    expect(normalizeUkPhone("7400123456")).toBe("+447400123456")
  })

  it("leaves E.164 input and unrecognized input for the caller to validate", async () => {
    const { normalizeUkPhone } = await import("@/lib/customer/phone")

    expect(normalizeUkPhone("+447400123456")).toBe("+447400123456")
    expect(normalizeUkPhone("+15551234567")).toBe("+15551234567")
    expect(normalizeUkPhone("not-a-number")).toBe("notanumber")
    expect(normalizeUkPhone("0770090")).toBe("0770090")
  })
})
