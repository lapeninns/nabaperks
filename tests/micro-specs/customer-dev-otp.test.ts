import { afterEach, describe, expect, it, vi } from "vitest"

describe("customer dev OTP bypass", () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    delete process.env.CUSTOMER_DEV_OTP_CODE
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_API_KEY_SID
    delete process.env.TWILIO_API_KEY_SECRET
    delete process.env.TWILIO_VERIFY_SERVICE_SID
  })

  it("approves the configured dev code without calling Twilio outside production", async () => {
    process.env.CUSTOMER_DEV_OTP_CODE = "424242"
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)
    const { checkCustomerPhoneVerification } = await import(
      "@/lib/customer/verification"
    )

    await expect(
      checkCustomerPhoneVerification("+447467586751", "424242")
    ).resolves.toEqual({ status: "approved" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
