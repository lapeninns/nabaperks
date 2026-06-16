import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

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

type ElementNode = { type?: unknown; props?: { children?: unknown } }

function findByType(node: unknown, type: unknown): ElementNode | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByType(child, type)
      if (found) return found
    }
    return null
  }

  if (!node || typeof node !== "object") return null
  const element = node as ElementNode
  if (element.type === type) return element

  return findByType(element.props?.children, type)
}

const sampleProfile = {
  merchant: {
    id: "merchant-1",
    owner_user_id: "user-1",
    business_name: "Old Cafe",
    business_type: "cafe",
    email: "old@example.test",
    phone: null,
  },
  location: {
    id: "loc-1",
    name: "Old Venue",
    address: null,
  },
}

// Venue name/address are edited solely in Launch -> Your venue now, so the
// profile form only carries the business/account identity fields.
const validEdits = {
  businessName: "New Cafe",
  businessType: "dessert",
  email: "new@example.test",
  phone: "+44 20 7946 0000",
}

describe("merchant profile micro-spec", () => {
  it("loads the signed-in merchant profile with its primary venue from server data", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        merchants: [
          {
            data: {
              id: "merchant-1",
              owner_user_id: "user-1",
              business_name: "The Bell",
              business_type: "pub",
              email: "hi@thebell.test",
              phone: "+441234567890",
            },
            error: null,
          },
        ],
        merchant_locations: [
          {
            data: { id: "loc-1", name: "Main bar", address: "1 High St" },
            error: null,
          },
        ],
      },
    })
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    const { getMerchantProfile } = await import("@/lib/merchant/profile")

    await expect(getMerchantProfile()).resolves.toEqual({
      merchant: {
        id: "merchant-1",
        owner_user_id: "user-1",
        business_name: "The Bell",
        business_type: "pub",
        email: "hi@thebell.test",
        phone: "+441234567890",
      },
      location: { id: "loc-1", name: "Main bar", address: "1 High St" },
    })
    expect(supabase.queryCalls).toContainEqual({
      table: "merchants",
      method: "eq",
      args: ["owner_user_id", "user-1"],
    })
  })

  it("returns no profile when there is no signed-in merchant owner", async () => {
    vi.resetModules()
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => null),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(),
    }))
    const { getMerchantProfile } = await import("@/lib/merchant/profile")

    await expect(getMerchantProfile()).resolves.toBeNull()
  })

  it("shows business identity in the form and the venue read-only", async () => {
    vi.resetModules()
    const MerchantProfileForm = vi.fn(() => null)
    vi.doMock("next/navigation", () => ({ redirect: redirectMock() }))
    vi.doMock("@/components/merchant/profile-form", () => ({
      MerchantProfileForm,
    }))
    vi.doMock("@/lib/merchant/profile", () => ({
      getMerchantProfile: vi.fn(async () => ({
        merchant: {
          id: "merchant-1",
          owner_user_id: "user-1",
          business_name: "The Bell",
          business_type: "pub",
          email: "hi@thebell.test",
          phone: "+441234567890",
        },
        location: { id: "loc-1", name: "Main bar", address: "1 High St" },
      })),
    }))
    const { ProfilePanel } =
      await import("@/components/merchant/account/profile-panel")

    const tree = await ProfilePanel()
    const formElement = findByType(tree, MerchantProfileForm)

    expect(formElement).not.toBeNull()
    expect(formElement?.props).toMatchObject({
      businessName: "The Bell",
      businessType: "pub",
      email: "hi@thebell.test",
      phone: "+441234567890",
    })
    // Venue is no longer editable here — the form must not own it.
    expect(formElement?.props).not.toHaveProperty("venueName")
    expect(formElement?.props).not.toHaveProperty("addressLine1")
  })

  it("redirects to onboarding when the merchant has no profile yet", async () => {
    vi.resetModules()
    const redirect = redirectMock()
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/merchant/profile", () => ({
      getMerchantProfile: vi.fn(async () => null),
    }))
    const { ProfilePanel } =
      await import("@/components/merchant/account/profile-panel")

    await expect(ProfilePanel()).rejects.toThrow(
      "NEXT_REDIRECT:/app/onboarding"
    )
  })

  it("persists business edits, leaves the venue untouched, and records changed fields", async () => {
    vi.resetModules()
    const revalidatePath = vi.fn()
    const recordProductEvent = vi.fn()
    const supabase = createSupabaseMock({
      from: {
        merchants: [{ data: null, error: null }],
      },
    })
    vi.doMock("next/cache", () => ({ revalidatePath }))
    vi.doMock("@/lib/merchant/profile", () => ({
      getMerchantProfile: vi.fn(async () => sampleProfile),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    vi.doMock("@/lib/analytics/events", () => ({ recordProductEvent }))
    const { updateMerchantProfileAction } =
      await import("@/app/app/profile/actions")

    await expect(
      updateMerchantProfileAction({}, form(validEdits))
    ).resolves.toMatchObject({ message: "Profile saved." })

    expect(supabase.queryCalls).toContainEqual({
      table: "merchants",
      method: "update",
      args: [
        {
          business_name: "New Cafe",
          business_type: "dessert",
          email: "new@example.test",
          phone: "+44 20 7946 0000",
        },
      ],
    })
    expect(supabase.queryCalls).toContainEqual({
      table: "merchants",
      method: "eq",
      args: ["id", "merchant-1"],
    })
    // The profile action never writes the venue row — that is Launch's job.
    const locationWrites = supabase.queryCalls.filter(
      (call) => call.table === "merchant_locations"
    )
    expect(locationWrites).toHaveLength(0)

    const event = recordProductEvent.mock.calls[0]?.[0]
    expect(event).toMatchObject({
      eventName: "merchant_profile_updated",
      merchantId: "merchant-1",
      actorType: "merchant",
      actorId: "user-1",
    })
    expect(event.metadata.changed_fields).toEqual(
      expect.arrayContaining([
        "business_name",
        "business_type",
        "email",
        "phone",
      ])
    )
    expect(event.metadata.changed_fields).not.toContain("location_name")
    expect(event.metadata.changed_fields).not.toContain("location_address")
    expect(revalidatePath).toHaveBeenCalledWith("/app/account")
    expect(revalidatePath).toHaveBeenCalledWith("/app/profile")
  })

  it("rejects invalid input with field-level errors and preserves entered values", async () => {
    vi.resetModules()
    const createSupabaseServerClient = vi.fn()
    const recordProductEvent = vi.fn()
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    vi.doMock("@/lib/merchant/profile", () => ({
      getMerchantProfile: vi.fn(async () => sampleProfile),
    }))
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient }))
    vi.doMock("@/lib/analytics/events", () => ({ recordProductEvent }))
    const { updateMerchantProfileAction } =
      await import("@/app/app/profile/actions")

    await expect(
      updateMerchantProfileAction(
        {},
        form({
          businessName: "",
          businessType: "spaceship",
          email: "not-an-email",
          phone: "abc",
        })
      )
    ).resolves.toMatchObject({
      fields: {
        businessName: "",
        businessType: "spaceship",
        email: "not-an-email",
        phone: "abc",
      },
      errors: {
        businessName: "Enter the business name.",
        businessType: "Choose a business type.",
        email: "Enter a valid contact email.",
        phone: "Enter a valid phone number.",
      },
    })
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
    expect(recordProductEvent).not.toHaveBeenCalled()
  })

  it("denies the update when the caller does not own a merchant profile", async () => {
    vi.resetModules()
    const createSupabaseServerClient = vi.fn()
    const recordProductEvent = vi.fn()
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    vi.doMock("@/lib/merchant/profile", () => ({
      getMerchantProfile: vi.fn(async () => null),
    }))
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient }))
    vi.doMock("@/lib/analytics/events", () => ({ recordProductEvent }))
    const { updateMerchantProfileAction } =
      await import("@/app/app/profile/actions")

    await expect(
      updateMerchantProfileAction({}, form(validEdits))
    ).resolves.toMatchObject({
      errors: { form: "Complete merchant onboarding first." },
    })
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
    expect(recordProductEvent).not.toHaveBeenCalled()
  })

  it("maps backend update failures to safe copy without recording an event", async () => {
    vi.resetModules()
    const recordProductEvent = vi.fn()
    const supabase = createSupabaseMock({
      from: {
        merchants: [
          { data: null, error: { message: "internal update detail" } },
        ],
      },
    })
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    vi.doMock("@/lib/merchant/profile", () => ({
      getMerchantProfile: vi.fn(async () => sampleProfile),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    vi.doMock("@/lib/analytics/events", () => ({ recordProductEvent }))
    const { updateMerchantProfileAction } =
      await import("@/app/app/profile/actions")

    await expect(
      updateMerchantProfileAction({}, form(validEdits))
    ).resolves.toMatchObject({
      errors: {
        form: "Profile could not be saved. Check your details and try again.",
      },
    })
    expect(recordProductEvent).not.toHaveBeenCalled()
  })

  it("keeps profile form field names, status banners, and a disabled submit", () => {
    const profileForm = readProjectFile("components/merchant/profile-form.tsx")

    for (const fieldName of [
      "businessName",
      "businessType",
      "email",
      "phone",
    ]) {
      expect(profileForm).toContain(`name="${fieldName}"`)
    }

    expect(profileForm).toContain("disabled={pending}")
    expect(profileForm).toContain("Save changes")
    expect(profileForm).toContain("Saving")
  })

  it("links the merchant profile through the account navigation hub", () => {
    const shell = readProjectFile("components/layout/merchant-app-shell.tsx")

    expect(shell).toContain('href: "/app/account", label: "Account"')
    expect(shell).not.toContain('href: "/app/profile"')
  })

  it("moves venue editing out of the profile form and over to Launch", () => {
    const profileForm = readProjectFile("components/merchant/profile-form.tsx")
    const profilePanel = readProjectFile(
      "components/merchant/account/profile-panel.tsx"
    )

    // The form no longer owns the venue — no duplicate editor.
    expect(profileForm).not.toContain("VenueAddressFields")
    expect(profileForm).not.toContain('name="venueName"')
    expect(profileForm).not.toContain('name="address"')

    // The panel shows the venue read-only and sends edits to the single editor.
    expect(profilePanel).toContain("What customers see")
    expect(profilePanel).toContain("/app/launch?tab=venue")
  })
})
