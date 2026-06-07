import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"
import { assetFilename, assetKindFromSlug } from "@/lib/qr/assets"

function form(values: Record<string, string | boolean>) {
  const data = new FormData()

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value === true ? "on" : String(value))
  }

  return data
}

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

function redirectMock() {
  return vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  })
}

describe("02 merchant and QR micro-specs", () => {
  it("requires an authenticated merchant owner before onboarding is saved", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => null),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { completeOnboardingAction } = await import(
      "@/app/app/onboarding/actions"
    )

    await expect(
      completeOnboardingAction({}, form({ businessName: "The Bell" }))
    ).resolves.toEqual({
      errors: { form: "Your session expired. Log in again." },
    })
    expect(redirect).not.toHaveBeenCalled()
  })

  it("creates a merchant onboarding record with a stable slug and signup event", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    const supabase = createSupabaseMock({
      rpc: {
        create_merchant_onboarding: [
          { data: [{ merchant_id: "merchant-1" }], error: null },
        ],
      },
    })
    const capturePostHogEvent = vi.fn()
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => ({
        id: "user-12345678-abc",
        email: "owner@example.test",
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    vi.doMock("@/lib/analytics/events", () => ({ capturePostHogEvent }))
    const { completeOnboardingAction } = await import(
      "@/app/app/onboarding/actions"
    )

    await expect(
      completeOnboardingAction(
        {},
        form({
          businessName: "A&B Coffee!",
          businessType: "cafe",
          locationName: "Main counter",
          phone: "+441234567890",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/app")

    expect(supabase.rpcCalls[0]).toEqual({
      name: "create_merchant_onboarding",
      params: expect.objectContaining({
        p_business_name: "A&B Coffee!",
        p_business_slug: "a-and-b-coffee-user-123",
        p_location_name: "Main counter",
      }),
    })
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "merchant_signed_up",
        merchantId: "merchant-1",
      })
    )
  })

  it("returns merchants with a missing first location to onboarding recovery", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/merchant/onboarding", () => ({
      getMerchantOnboardingStatus: vi.fn(async () => ({
        status: "missing_location",
        merchant: { id: "merchant-1", business_name: "The Bell" },
        initialFields: {
          businessName: "The Bell",
          businessType: "pub",
          phone: "+441234567890",
        },
      })),
    }))
    vi.doMock("@/lib/merchant/dashboard", () => ({
      getMerchantDashboardData: vi.fn(),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { default: MerchantAppPage } = await import("@/app/app/page")

    await expect(MerchantAppPage()).rejects.toThrow(
      "NEXT_REDIRECT:/app/onboarding"
    )
  })

  it("keeps saved business fields visible when recovering a missing first location", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    const OnboardingForm = vi.fn(() => null)
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/components/merchant/onboarding-form", () => ({
      OnboardingForm,
    }))
    vi.doMock("@/lib/merchant/onboarding", () => ({
      getMerchantOnboardingStatus: vi.fn(async () => ({
        status: "missing_location",
        merchant: { id: "merchant-1", business_name: "The Bell" },
        initialFields: {
          businessName: "The Bell",
          businessType: "pub",
          phone: "+441234567890",
        },
      })),
    }))
    const { default: OnboardingPage } = await import("@/app/app/onboarding/page")

    const page = (await OnboardingPage()) as {
      props: { children: [unknown, { props: { initialFields: unknown } }] }
    }

    expect(redirect).not.toHaveBeenCalled()
    expect(OnboardingForm).not.toHaveBeenCalled()
    expect(page.props.children[1].props.initialFields).toEqual({
      businessName: "The Bell",
      businessType: "pub",
      phone: "+441234567890",
    })
  })

  it("validates mystery card builder input before calling the save_loyalty_card RPC", async () => {
    vi.resetModules()
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({ id: "merchant-1" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { saveLoyaltyCardAction } = await import("@/app/app/card/actions")

    await expect(
      saveLoyaltyCardAction(
        {},
        form({
          cardName: "",
          stampsRequired: "0",
          rewardTerms: "short",
        })
      )
    ).resolves.toMatchObject({
      errors: {
        cardName: "Enter a card name.",
        stampsRequired: "Use at least 1 stamp.",
        rewardTerms: "Add enough detail for customers to understand the offer.",
      },
    })
  })

  it("saves an active mystery visit card with the default teaser and records analytics", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    const supabase = createSupabaseMock({
      rpc: { save_loyalty_card: [{ data: null, error: null }] },
    })
    const capturePostHogEvent = vi.fn()
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({ id: "merchant-1" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    vi.doMock("@/lib/analytics/events", () => ({ capturePostHogEvent }))
    const { saveLoyaltyCardAction } = await import("@/app/app/card/actions")

    await expect(
      saveLoyaltyCardAction(
        {},
        form({
          cardName: "Mystery Visit Card",
          stampsRequired: "3",
          rewardTerms:
            "Complete 3 visits to reveal a surprise reward. Redeem from the next UK business day.",
          isActive: true,
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/app/card?saved=1")

    expect(supabase.rpcCalls[0]).toEqual({
      name: "save_loyalty_card",
      params: expect.objectContaining({
        p_merchant_id: "merchant-1",
        p_card_name: "Mystery Visit Card",
        p_stamps_required: 3,
        p_reward_name: "Surprise reward",
        p_min_spend_pence: null,
        p_is_active: true,
      }),
    })
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "loyalty_card_created",
        merchantId: "merchant-1",
      })
    )
  })

  it("saves merchant-managed reward pool items with weight and display order", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    const supabase = createSupabaseMock({
      rpc: {
        upsert_reward_pool_item: [
          {
            data: [
              {
                reward_pool_item_id: "pool-1",
                saved_action: "reward_pool_item_created",
              },
            ],
            error: null,
          },
        ],
      },
    })
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({ id: "merchant-1" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { saveRewardPoolItemAction } = await import("@/app/app/card/actions")

    await expect(
      saveRewardPoolItemAction(
        {},
        form({
          loyaltyCardId: "card-1",
          rewardName: "Coffee upgrade",
          rewardTerms: "Valid on one hot drink from the next business day.",
          minSpendPence: "250",
          weight: "3",
          displayOrder: "2",
          isActive: true,
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/app/card?saved=pool")

    expect(supabase.rpcCalls[0]).toEqual({
      name: "upsert_reward_pool_item",
      params: {
        p_merchant_id: "merchant-1",
        p_loyalty_card_id: "card-1",
        p_reward_pool_item_id: null,
        p_reward_name: "Coffee upgrade",
        p_reward_terms: "Valid on one hot drink from the next business day.",
        p_min_spend_pence: 250,
        p_weight: 3,
        p_is_active: true,
        p_display_order: 2,
      },
    })
  })

  it("keeps merchant workflow form field names and safe status banners visible", () => {
    const onboardingForm = readProjectFile("components/merchant/onboarding-form.tsx")
    const cardForm = readProjectFile("components/merchant/loyalty-card-form.tsx")
    const cardPage = readProjectFile("app/app/card/page.tsx")
    const qrPage = readProjectFile("app/app/qr/page.tsx")
    const staffPinForm = readProjectFile(
      "components/merchant/staff-pin-settings-form.tsx"
    )
    const roiForm = readProjectFile("components/merchant/roi-settings-form.tsx")

    for (const fieldName of [
      "businessName",
      "businessType",
      "locationName",
      "phone",
    ]) {
      expect(onboardingForm).toContain(`name="${fieldName}"`)
    }

    for (const fieldName of [
      "cardId",
      "cardName",
      "stampsRequired",
      "rewardTerms",
      "minSpendPence",
      "isActive",
      "loyaltyCardId",
      "rewardPoolItemId",
      "rewardName",
      "weight",
      "displayOrder",
    ]) {
      expect(cardForm).toContain(`name="${fieldName}"`)
    }

    expect(cardPage).toContain('params.saved === "1"')
    expect(cardPage).toContain('params.saved === "pool"')
    expect(cardPage).toContain("Unable to update reward")
    expect(cardForm).toContain("QR launch is blocked until a reward is active.")
    expect(cardForm).toContain("No rewards in the pool yet")
    expect(cardForm).toContain("Inactive reward")

    expect(qrPage).toContain("QrFrame")
    expect(qrPage).toContain("Add or activate a reward")
    expect(qrPage).toContain('name="qrCodeId"')
    expect(qrPage).toContain('name="nextActive"')

    for (const fieldName of ["pin", "confirmPin"]) {
      expect(staffPinForm).toContain(`name={id}`)
      expect(staffPinForm).toContain(`id="${fieldName}"`)
    }
    expect(staffPinForm).toContain('type="password"')
    expect(staffPinForm).toContain('inputMode="numeric"')

    for (const fieldName of [
      "averageOrderValue",
      "estimatedGrossMargin",
      "rewardCost",
    ]) {
      expect(roiForm).toContain(`name={id}`)
      expect(roiForm).toContain(`id="${fieldName}"`)
    }
    expect(roiForm).toContain("Save settings")
  })

  it("maps protected merchant action backend errors to safe copy", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    const onboardingSupabase = createSupabaseMock({
      rpc: {
        create_merchant_onboarding: [
          { data: null, error: { message: "violates internal constraint" } },
        ],
      },
    })
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => ({
        id: "user-12345678-abc",
        email: "owner@example.test",
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => onboardingSupabase.client),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { completeOnboardingAction } = await import(
      "@/app/app/onboarding/actions"
    )

    await expect(
      completeOnboardingAction(
        {},
        form({
          businessName: "The Bell",
          businessType: "pub",
          locationName: "Main counter",
          phone: "+441234567890",
        })
      )
    ).resolves.toEqual({
      fields: {
        businessName: "The Bell",
        businessType: "pub",
        locationName: "Main counter",
        phone: "+441234567890",
      },
      errors: {
        form: "Profile could not be saved. Check your details and try again.",
      },
    })

    vi.resetModules()
    const cardSupabase = createSupabaseMock({
      rpc: {
        save_loyalty_card: [
          { data: null, error: { message: "rpc stack detail" } },
        ],
        upsert_reward_pool_item: [
          { data: null, error: { message: "postgres detail" } },
        ],
        delete_reward_pool_item: [
          { data: null, error: { message: "delete detail" } },
        ],
      },
    })
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({ id: "merchant-1" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => cardSupabase.client),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const {
      deleteRewardPoolItemAction,
      saveLoyaltyCardAction,
      saveRewardPoolItemAction,
    } = await import("@/app/app/card/actions")

    await expect(
      saveLoyaltyCardAction(
        {},
        form({
          cardName: "Mystery Visit Card",
          stampsRequired: "3",
          rewardTerms:
            "Complete 3 visits to reveal a surprise reward. Redeem from the next UK business day.",
        })
      )
    ).resolves.toMatchObject({
      errors: {
        form: "Mystery card could not be saved. Check your details and try again.",
      },
    })

    await expect(
      saveRewardPoolItemAction(
        {},
        form({
          loyaltyCardId: "card-1",
          rewardName: "Coffee upgrade",
          rewardTerms: "Valid on one hot drink from the next business day.",
          minSpendPence: "250",
          weight: "3",
          displayOrder: "2",
          isActive: true,
        })
      )
    ).resolves.toMatchObject({
      errors: {
        form: "Reward could not be saved. Check your details and try again.",
      },
    })

    await expect(
      deleteRewardPoolItemAction(form({ rewardPoolItemId: "pool-1" }))
    ).rejects.toThrow("NEXT_REDIRECT:/app/card?error=Unable%20to%20update%20reward")
  })

  it("requires at least one active reward pool item before launching the permanent venue QR", async () => {
    vi.resetModules()
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/lib/merchant/qr-code", () => ({
      getQrSetup: vi.fn(async () => ({
        merchant: { id: "merchant-1" },
        activeCard: { id: "card-1" },
        activeRewardPoolItemCount: 0,
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(),
    }))
    const { generateQrCodeAction } = await import("@/app/app/qr/actions")

    await expect(generateQrCodeAction()).rejects.toThrow(
      "NEXT_REDIRECT:/app/qr?error=Add%20at%20least%20one%20active%20mystery%20reward%20before%20launching%20the%20QR."
    )
  })

  it("creates or reuses one permanent venue join QR only after a merchant, active card, and reward pool exist", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    const supabase = createSupabaseMock({
      rpc: { create_or_get_join_qr: [{ data: null, error: null }] },
    })
    const capturePostHogEvent = vi.fn()
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/merchant/qr-code", () => ({
      getQrSetup: vi.fn(async () => ({
        merchant: { id: "merchant-1" },
        activeCard: { id: "card-1" },
        activeRewardPoolItemCount: 1,
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    vi.doMock("@/lib/analytics/events", () => ({ capturePostHogEvent }))
    const { generateQrCodeAction } = await import("@/app/app/qr/actions")

    await expect(generateQrCodeAction()).rejects.toThrow(
      "NEXT_REDIRECT:/app/qr?created=1"
    )
    expect(supabase.rpcCalls[0]).toEqual({
      name: "create_or_get_join_qr",
      params: {
        p_merchant_id: "merchant-1",
        p_loyalty_card_id: "card-1",
      },
    })
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "qr_created",
        merchantId: "merchant-1",
        actorType: "merchant",
      })
    )
  })

  it("toggles QR active status with preserved hidden fields and safe error redirects", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    const supabase = createSupabaseMock({
      rpc: { set_qr_active: [{ data: null, error: null }] },
    })
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/merchant/qr-code", () => ({
      getQrSetup: vi.fn(async () => ({
        merchant: { id: "merchant-1" },
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    const { setQrActiveAction } = await import("@/app/app/qr/actions")

    await expect(
      setQrActiveAction(
        form({ qrCodeId: "qr-row-1", nextActive: "false" })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/app/qr?disabled=1")
    expect(supabase.rpcCalls[0]).toEqual({
      name: "set_qr_active",
      params: {
        p_merchant_id: "merchant-1",
        p_qr_code_id: "qr-row-1",
        p_is_active: false,
      },
    })

    vi.resetModules()
    const failingSupabase = createSupabaseMock({
      rpc: {
        set_qr_active: [
          { data: null, error: { message: "internal qr detail" } },
        ],
      },
    })
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/merchant/qr-code", () => ({
      getQrSetup: vi.fn(async () => ({
        merchant: { id: "merchant-1" },
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => failingSupabase.client),
    }))
    const { setQrActiveAction: failingSetQrActiveAction } = await import(
      "@/app/app/qr/actions"
    )

    await expect(
      failingSetQrActiveAction(
        form({ qrCodeId: "qr-row-1", nextActive: "true" })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/app/qr?error=Unable%20to%20update%20QR")
  })

  it("saves ROI settings to dashboard-estimate fields and revalidates readbacks", async () => {
    vi.resetModules()
    const revalidatePath = vi.fn()
    const supabase = createSupabaseMock({
      from: { merchants: [{ data: null, error: null }] },
    })
    vi.doMock("next/cache", () => ({ revalidatePath }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({ id: "merchant-1" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    const { saveRoiSettingsAction } = await import(
      "@/app/app/settings/actions"
    )

    await expect(
      saveRoiSettingsAction(
        {},
        form({
          averageOrderValue: "12.50",
          estimatedGrossMargin: "64.25",
          rewardCost: "3.10",
        })
      )
    ).resolves.toMatchObject({
      message: "Settings saved.",
    })
    expect(supabase.queryCalls).toContainEqual({
      table: "merchants",
      method: "update",
      args: [
        {
          average_order_value_pence: 1250,
          estimated_gross_margin_bps: 6425,
          reward_cost_pence: 310,
        },
      ],
    })
    expect(supabase.queryCalls).toContainEqual({
      table: "merchants",
      method: "eq",
      args: ["id", "merchant-1"],
    })
    expect(revalidatePath).toHaveBeenCalledWith("/app")
    expect(revalidatePath).toHaveBeenCalledWith("/app/settings")

    vi.resetModules()
    const failingSupabase = createSupabaseMock({
      from: {
        merchants: [
          { data: null, error: { message: "internal update detail" } },
        ],
      },
    })
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({ id: "merchant-1" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => failingSupabase.client),
    }))
    const { saveRoiSettingsAction: failingSaveRoiSettingsAction } =
      await import("@/app/app/settings/actions")

    await expect(
      failingSaveRoiSettingsAction(
        {},
        form({
          averageOrderValue: "12.50",
          estimatedGrossMargin: "64.25",
          rewardCost: "3.10",
        })
      )
    ).resolves.toMatchObject({
      errors: { form: "Settings could not be saved. Try again." },
    })
  })

  it("maps QR asset slugs and filenames to stable downloadable formats", () => {
    expect(assetKindFromSlug("poster")).toBe("poster_pdf")
    expect(assetKindFromSlug("till-card")).toBe("till_card_png")
    expect(assetKindFromSlug("sticker")).toBe("sticker_png")
    expect(assetKindFromSlug("unknown")).toBeNull()
    expect(assetFilename("poster_pdf", "qr-live")).toBe(
      "stampiee-poster-pdf-qr-live.pdf"
    )
    expect(assetFilename("sticker_png", "qr-live")).toBe(
      "stampiee-sticker-png-qr-live.png"
    )
  })

  it("records QR downloads before returning a private asset response", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      rpc: { record_qr_download: [{ data: null, error: null }] },
    })
    const capturePostHogEvent = vi.fn()
    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://stampiee.test" }),
    }))
    vi.doMock("@/lib/merchant/qr-code", () => ({
      getOwnedQrAssetContext: vi.fn(async () => ({
        merchant: { id: "merchant-1", business_name: "The Bell" },
        location: { name: "Main bar" },
        activeCard: {
          card_name: "Mystery Visit Card",
          reward_name: "Surprise reward",
        },
        qrCode: { id: "qr-row-1", qr_id: "qr-public", is_active: true },
      })),
    }))
    vi.doMock("@/lib/analytics/events", () => ({ capturePostHogEvent }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    vi.doMock("@/lib/qr/assets", () => ({
      assetFilename: () => "stampiee-till-card-png-qr-public.png",
      assetKindFromSlug: () => "till_card_png",
      renderQrAssetPng: vi.fn(async () => new Uint8Array([1, 2, 3])),
      renderQrPosterPdf: vi.fn(),
    }))
    const { GET } = await import("@/app/app/qr/download/[asset]/route")

    const response = await GET(
      new Request("https://stampiee.test/app/qr/download/till-card?qr=qr-row-1"),
      { params: Promise.resolve({ asset: "till-card" }) }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("image/png")
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(response.headers.get("Content-Disposition")).toContain(
      "stampiee-till-card-png-qr-public.png"
    )
    expect(supabase.rpcCalls[0]).toEqual({
      name: "record_qr_download",
      params: {
        p_merchant_id: "merchant-1",
        p_qr_code_id: "qr-row-1",
        p_asset_type: "till_card_png",
      },
    })
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "qr_downloaded",
        qrCodeId: "qr-row-1",
      })
    )
  })
})
