import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

type CustomerContact = {
  email: string | null
  emailVerifiedAt: string | null
}

describe("customer contact immutability", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/supabase/server")
    vi.doUnmock("@/lib/customer/identity")
  })

  async function setup(customer: CustomerContact) {
    vi.resetModules()
    const mock = createSupabaseMock({})
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: async () => mock.client,
      createSupabaseServiceRoleClient: () => mock.client,
    }))
    vi.doMock("@/lib/customer/identity", () => ({
      getCurrentCustomer: vi.fn(async () => ({
        id: "customer-1",
        authUserId: null,
        email: customer.email,
        emailVerifiedAt: customer.emailVerifiedAt,
        fullName: "Sam Taylor",
        dateOfBirth: "1990-01-01",
        phone: "Phone ending 3456",
        phoneLast4: "3456",
        phoneCountry: "GB",
        createdAt: "2026-06-13T12:00:00.000Z",
      })),
    }))

    const profile = await import("@/lib/customer/profile")
    return { ...profile, mock }
  }

  it("preserves verified email when a tampered profile form submits a different email", async () => {
    const { updateCustomerProfile, mock } = await setup({
      email: "verified@example.test",
      emailVerifiedAt: "2026-06-17T10:00:00.000Z",
    })

    const result = await updateCustomerProfile({
      fullName: "Sam Updated",
      dateOfBirth: "1991-02-03",
      email: "tampered@example.test",
    })

    const update = mock.queryCalls.find((call) => call.method === "update")
    expect(result).toMatchObject({
      email: "verified@example.test",
      emailVerificationRequired: false,
      emailLocked: true,
    })
    expect(update?.args[0]).toMatchObject({
      full_name: "Sam Updated",
      date_of_birth: "1991-02-03",
    })
    expect(update?.args[0]).not.toHaveProperty("email")
    expect(update?.args[0]).not.toHaveProperty("email_verified_at")
  })

  it("preserves verified email when a tampered profile form submits blank email", async () => {
    const { updateCustomerProfile, mock } = await setup({
      email: "verified@example.test",
      emailVerifiedAt: "2026-06-17T10:00:00.000Z",
    })

    await updateCustomerProfile({
      fullName: "Sam Updated",
      dateOfBirth: "1991-02-03",
      email: "",
    })

    const update = mock.queryCalls.find((call) => call.method === "update")
    expect(update?.args[0]).not.toHaveProperty("email")
    expect(update?.args[0]).not.toHaveProperty("email_verified_at")
  })

  it("rejects verifying a different pending email over an already verified email", async () => {
    const { markCustomerEmailVerified } = await setup({
      email: "verified@example.test",
      emailVerifiedAt: "2026-06-17T10:00:00.000Z",
    })

    await expect(
      markCustomerEmailVerified("pending@example.test")
    ).rejects.toThrow(/locked/i)
  })

  it("allows verifying the existing unverified email", async () => {
    const { markCustomerEmailVerified, mock } = await setup({
      email: "pending@example.test",
      emailVerifiedAt: null,
    })

    await markCustomerEmailVerified("pending@example.test")

    const update = mock.queryCalls.find((call) => call.method === "update")
    expect(update?.args[0]).toMatchObject({ email: "pending@example.test" })
    expect(update?.args[0]).toHaveProperty("email_verified_at")
  })

  it("does not clear verified email", async () => {
    const { clearCustomerEmail, mock } = await setup({
      email: "verified@example.test",
      emailVerifiedAt: "2026-06-17T10:00:00.000Z",
    })

    const result = await clearCustomerEmail()
    const update = mock.queryCalls.find((call) => call.method === "update")

    expect(result).toMatchObject({ cleared: false, emailLocked: true })
    expect(update).toBeUndefined()
  })

  it("clears unverified email", async () => {
    const { clearCustomerEmail, mock } = await setup({
      email: "pending@example.test",
      emailVerifiedAt: null,
    })

    const result = await clearCustomerEmail()
    const update = mock.queryCalls.find((call) => call.method === "update")

    expect(result).toMatchObject({ cleared: true, emailLocked: false })
    expect(update?.args[0]).toMatchObject({
      email: null,
      email_verified_at: null,
    })
  })
})
