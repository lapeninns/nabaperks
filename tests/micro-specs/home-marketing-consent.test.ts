import { afterEach, describe, expect, it, vi } from "vitest"

describe("home marketing consent action", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/customer/consent")
    vi.doUnmock("next/cache")
  })

  function form(values: Record<string, string>) {
    const data = new FormData()
    for (const [key, value] of Object.entries(values)) data.set(key, value)
    return data
  }

  function mockConsent() {
    const updateCustomerMarketingConsent = vi.fn(async () => {})
    vi.doMock("@/lib/customer/consent", () => ({
      updateCustomerMarketingConsent,
      isMarketingChannel: (value: string) =>
        ["email", "sms", "whatsapp"].includes(value),
      MARKETING_POLICY_VERSION: "2026-06-06",
    }))
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    return { updateCustomerMarketingConsent }
  }

  it("records an opt-in through the consent RPC", async () => {
    const { updateCustomerMarketingConsent } = mockConsent()
    const { updateHomeMarketingConsentAction } =
      await import("@/app/home/(authed)/profile/actions")

    const result = await updateHomeMarketingConsentAction(
      {},
      form({ channel: "sms", optedIn: "on" })
    )

    expect(updateCustomerMarketingConsent).toHaveBeenCalledWith({
      channel: "sms",
      optedIn: true,
    })
    expect(result).toMatchObject({ channel: "sms", optedIn: true })
    expect(result.error).toBeUndefined()
  })

  it("records an opt-out when the toggle is unchecked", async () => {
    const { updateCustomerMarketingConsent } = mockConsent()
    const { updateHomeMarketingConsentAction } =
      await import("@/app/home/(authed)/profile/actions")

    await updateHomeMarketingConsentAction({}, form({ channel: "email" }))

    expect(updateCustomerMarketingConsent).toHaveBeenCalledWith({
      channel: "email",
      optedIn: false,
    })
  })

  it("rejects an unknown channel without recording", async () => {
    const { updateCustomerMarketingConsent } = mockConsent()
    const { updateHomeMarketingConsentAction } =
      await import("@/app/home/(authed)/profile/actions")

    const result = await updateHomeMarketingConsentAction(
      {},
      form({ channel: "not-supported", optedIn: "on" })
    )

    expect(result.error).toBeTruthy()
    expect(updateCustomerMarketingConsent).not.toHaveBeenCalled()
  })
})
