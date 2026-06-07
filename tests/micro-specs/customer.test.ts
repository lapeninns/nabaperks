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

describe("03 customer micro-specs", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/customer/join")
    vi.doUnmock("@/lib/customer/card")
    vi.doUnmock("@/lib/customer/reward")
    vi.doUnmock("@/lib/auth/session")
    vi.doUnmock("@/components/customer/join-forms")
    vi.doUnmock("@/components/customer/reward-redemption-form")
    vi.doUnmock("next/navigation")
  })

  it("preserves customer, staff, and reward form/action contracts after the mobile redesign", () => {
    const joinForms = readProjectFile("components/customer/join-forms.tsx")
    const joinActions = readProjectFile("app/m/[merchantSlug]/join/actions.ts")
    const rewardForm = readProjectFile(
      "components/customer/reward-redemption-form.tsx"
    )
    const rewardActions = readProjectFile("app/reward/[rewardId]/actions.ts")
    const staffForm = readProjectFile("components/staff/staff-pin-form.tsx")
    const staffActions = readProjectFile("app/staff/stamp/actions.ts")

    for (const field of [
      "merchantSlug",
      "qrId",
      "contact",
      "otp",
    ]) {
      expect(joinForms).toContain(`name="${field}"`)
      expect(joinActions).toContain(`value(formData, "${field}")`)
    }

    for (const checkbox of ["loyaltyTerms", "marketingOptIn"]) {
      expect(joinForms).toContain(`name="${checkbox}"`)
      expect(joinActions).toContain(`formData.get("${checkbox}")`)
    }

    expect(rewardForm).toContain(`name="rewardId"`)
    expect(rewardForm).toContain(`name="pin"`)
    expect(rewardForm).toContain(`type="password"`)
    expect(rewardForm).toContain(`inputMode="numeric"`)
    expect(rewardActions).toContain(`value(formData, "rewardId")`)
    expect(rewardActions).toContain(`value(formData, "pin")`)
    expect(rewardActions).toContain(`"redeem_reward_with_staff_pin"`)
    expect(rewardActions).toContain(`p_reward_id: rewardId`)
    expect(rewardActions).toContain(`p_pin: pin`)

    expect(staffForm).toContain(`name="membershipId"`)
    expect(staffForm).toContain(`name="pin"`)
    expect(staffForm).toContain(`type="password"`)
    expect(staffForm).toContain(`inputMode="numeric"`)
    expect(staffForm).toContain(`size="lg"`)
    expect(staffActions).toContain(`value(formData, "membershipId")`)
    expect(staffActions).toContain(`value(formData, "pin")`)
    expect(staffActions).toContain(`"issue_stamp_with_staff_pin"`)
    expect(staffActions).toContain(`p_membership_id: membershipId`)
    expect(staffActions).toContain(`p_pin: pin`)
    expect(staffActions).toContain("`/card/${membershipId}?stamp=issued`")
  })

  it("keeps customer and staff pages mobile-first with loyalty primitives and safe state copy", () => {
    const landingPage = readProjectFile("app/m/[merchantSlug]/page.tsx")
    const joinPage = readProjectFile("app/m/[merchantSlug]/join/page.tsx")
    const cardPage = readProjectFile("app/card/[membershipId]/page.tsx")
    const rewardPage = readProjectFile("app/reward/[rewardId]/page.tsx")
    const staffPage = readProjectFile("app/staff/stamp/page.tsx")
    const qrPage = readProjectFile("app/q/[qrId]/page.tsx")
    const termsPage = readProjectFile("app/merchant/[merchantSlug]/terms/page.tsx")

    expect(landingPage).toContain("CustomerShell")
    expect(landingPage).toContain("getMerchantJoinContext")
    expect(landingPage).toContain("No app loyalty")
    expect(landingPage).toContain("`/m/${merchantSlug}/join`")
    expect(landingPage).toContain("`/merchant/${merchantSlug}/terms`")

    expect(joinPage).toContain("CustomerShell")
    expect(joinPage).toContain("StampGrid")
    expect(joinPage).toContain("ProgressTrack")
    expect(joinPage).toContain("This loyalty card is unavailable")
    expect(joinPage).toContain("Ask a team member for the current loyalty QR.")
    expect(joinPage).toContain("Open your stamp card")

    expect(cardPage).toContain("CustomerShell")
    expect(cardPage).toContain("StampGrid")
    expect(cardPage).toContain("ProgressTrack")
    expect(cardPage).toContain("RewardTeaser")
    expect(cardPage).toContain("Stamp added.")
    expect(cardPage).toContain("Claim stamp")
    expect(cardPage).toContain("Redeem reward")

    expect(rewardPage).toContain("CustomerShell")
    expect(rewardPage).toContain("RewardTeaser")
    expect(rewardPage).toContain(
      "Come back from the next UK business day to redeem this reward."
    )
    expect(rewardPage).toContain("Ready for staff confirmation.")

    expect(staffPage).toContain("StaffShell")
    expect(staffPage).toContain("ProgressTrack")
    expect(staffPage).toContain("Open from a customer card")
    expect(staffPage).toContain("Start a stamp claim from the customer's digital card.")

    expect(qrPage).toContain("This loyalty card is unavailable")
    expect(qrPage).toContain("Ask a team member for the current loyalty QR.")
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
    const { default: MerchantRewardsPage } = await import(
      "@/app/m/[merchantSlug]/page"
    )

    const output = await MerchantRewardsPage({
      params: Promise.resolve({ merchantSlug: "bean-and-batch" }),
    })
    const renderedText = normalizeText(output)

    expect(renderedText).toContain("Bean & Batch Rewards")
    expect(renderedText).toContain("Morning visits")
    expect(renderedText).toContain("3")
    expect(renderedText).toContain("Join rewards")
    expect(renderedText).toContain("View reward terms")
  })

  it("renders returning-member join state with progress and an onward card path", async () => {
    vi.resetModules()
    vi.doMock("@/components/customer/join-forms", () => ({
      CustomerIdentityForm: () => null,
      CustomerJoinForm: () => null,
    }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
    }))
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
    const { default: MerchantJoinPage } = await import(
      "@/app/m/[merchantSlug]/join/page"
    )

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
    const { default: CustomerCardPage } = await import(
      "@/app/card/[membershipId]/page"
    )

    const cardOutput = await CustomerCardPage({
      params: Promise.resolve({ membershipId: "membership-1" }),
      searchParams: Promise.resolve({ stamp: "issued" }),
    })
    const cardText = normalizeText(cardOutput)

    expect(cardText).toContain("Stamp added.")
    expect(cardText).toContain("2")
    expect(cardText).toContain("3")
    expect(cardText).toContain("Mystery reward")
    expect(cardText).toContain("Claim stamp")

    vi.resetModules()
    vi.doMock("@/components/customer/reward-redemption-form", () => ({
      RewardRedemptionForm: () => "PIN form",
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
    })
    const rewardText = normalizeText(rewardOutput)

    expect(rewardText).toContain("Cake slice")
    expect(rewardText).toContain(
      "Come back from the next UK business day to redeem this reward."
    )
    expect(rewardText).toContain("Return to card")
    expect(rewardText).not.toContain("PIN form")
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
    const { default: MerchantTermsPage } = await import(
      "@/app/merchant/[merchantSlug]/terms/page"
    )

    const output = await MerchantTermsPage({
      params: Promise.resolve({ merchantSlug: "bean-and-batch" }),
    })
    const renderedText = normalizeText(output)

    expect(renderedText).toContain("Bean & Batch loyalty terms")
    expect(renderedText).toContain("Ask the venue team")
    expect(renderedText).toContain("Join rewards")
    expect(renderedText).toContain("Privacy notice")
  })

  it("rejects invalid customer identity input before sending OTP", async () => {
    vi.resetModules()
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://stampiee.test" }),
    }))
    vi.doMock("@/lib/security/rate-limit", async () => {
      const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>(
        "@/lib/security/rate-limit"
      )
      return actual
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(),
    }))
    vi.doMock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { requestCustomerIdentityAction } = await import(
      "@/app/m/[merchantSlug]/join/actions"
    )

    await expect(
      requestCustomerIdentityAction(
        {},
        form({ contact: "not-contact", merchantSlug: "the-bell", qrId: "qr-1" })
      )
    ).resolves.toMatchObject({
      errors: { contact: "Enter an email address or E.164 phone number." },
    })
  })

  it("sends email OTP with an own-domain join return URL", async () => {
    vi.resetModules()
    vi.doUnmock("@/lib/security/rate-limit")
    vi.doUnmock("@/lib/supabase/server")
    const signInWithOtp = vi.fn(
      async (payload: {
        email?: string
        phone?: string
        options?: { emailRedirectTo?: string }
      }) => {
        void payload
        return { error: null }
      }
    )
    const supabase = createSupabaseMock({
      auth: { signInWithOtp },
    })
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://stampiee.test" }),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
      createSupabaseServiceRoleClient: vi.fn(() => createSupabaseMock().client),
    }))
    vi.doMock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { requestCustomerIdentityAction } = await import(
      "@/app/m/[merchantSlug]/join/actions"
    )

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
      message: "Check your email to continue joining rewards.",
    })
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "guest@example.test",
      options: {
        emailRedirectTo: expect.stringContaining(
          "https://stampiee.test/auth/confirm?next="
        ),
      },
    })
    const otpPayload = signInWithOtp.mock.calls[0]?.[0]
    expect(otpPayload?.options?.emailRedirectTo).toContain(
      encodeURIComponent("/m/the-bell/join?qr=qr-public")
    )
  })

  it("requires verified identity and loyalty terms before joining rewards", async () => {
    vi.resetModules()
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => null),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(),
    }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://stampiee.test" }),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { joinRewardsAction } = await import(
      "@/app/m/[merchantSlug]/join/actions"
    )

    await expect(
      joinRewardsAction({}, form({ merchantSlug: "the-bell" }))
    ).resolves.toEqual({
      errors: { form: "Verify your email or phone before joining." },
    })
  })

  it("creates a membership with separate marketing consent and redirects to the digital card", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    const capturePostHogEvent = vi.fn()
    const supabase = createSupabaseMock({
      rpc: {
        join_customer_membership: [
          { data: [{ membership_id: "membership-1" }], error: null },
        ],
      },
    })
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => ({ id: "customer-user-1" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://stampiee.test" }),
    }))
    vi.doMock("@/lib/analytics/events", () => ({ capturePostHogEvent }))
    const { joinRewardsAction } = await import(
      "@/app/m/[merchantSlug]/join/actions"
    )

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
    ).rejects.toThrow("NEXT_REDIRECT:/card/membership-1")
    expect(supabase.rpcCalls[0]).toEqual({
      name: "join_customer_membership",
      params: {
        p_merchant_slug: "the-bell",
        p_qr_id: "qr-public",
        p_marketing_opt_in: true,
        p_policy_version: "2026-06-06",
      },
    })
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "customer_joined",
        membershipId: "membership-1",
        metadata: {
          merchant_slug: "the-bell",
          marketing_opt_in: true,
        },
      })
    )
  })

  it("maps join membership backend failures to safe customer copy", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      rpc: {
        join_customer_membership: [
          {
            data: null,
            error: { message: "internal Supabase policy detail" },
          },
        ],
      },
    })
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => ({ id: "customer-user-1" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { joinRewardsAction } = await import(
      "@/app/m/[merchantSlug]/join/actions"
    )

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
      const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>(
        "@/lib/security/rate-limit"
      )
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
      const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>(
        "@/lib/security/rate-limit"
      )
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
      const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>(
        "@/lib/security/rate-limit"
      )
      return actual
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }))
    vi.doMock("@/lib/analytics/events", () => ({ recordProductEvent }))
    const { getMerchantJoinContext, resolveQrForJoin } = await import(
      "@/lib/customer/join"
    )

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
              customers: { auth_user_id: "user-1" },
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
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
    }))
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
              customers: { auth_user_id: "user-1" },
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
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
    }))
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
              reward_terms: "Valid on one cake slice from the next business day.",
              min_spend_pence: 500,
              redeemable_from: "2026-06-08",
              customers: { auth_user_id: "user-1" },
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
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
    }))
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

  it("maps next-business-day redemption errors to a customer-facing wait message", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      rpc: {
        redeem_reward_with_staff_pin: [
          {
            data: null,
            error: {
              message:
                "Reward is not redeemable until the next UK business day",
            },
          },
        ],
      },
    })
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { redeemRewardAction } = await import(
      "@/app/reward/[rewardId]/actions"
    )

    await expect(
      redeemRewardAction({}, form({ rewardId: "reward-1", pin: "1234" }))
    ).resolves.toMatchObject({
      fields: { rewardId: "reward-1" },
      errors: {
        form: "Come back from the next UK business day to redeem this reward.",
      },
    })
  })
})
