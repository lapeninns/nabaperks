import { afterEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"

function form(values: Record<string, string>) {
  const data = new FormData()

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value)
  }

  return data
}

function fixedHeaders(values: Record<string, string>) {
  return new Headers(values)
}

describe("customer global phone auth", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_API_KEY_SID
    delete process.env.TWILIO_API_KEY_SECRET
    delete process.env.TWILIO_VERIFY_SERVICE_SID
    delete process.env.CUSTOMER_SESSION_SECRET
    delete process.env.CUSTOMER_PHONE_HMAC_SECRET
    delete process.env.CUSTOMER_PHONE_ENCRYPTION_KEY
  })

  it("parses E.164 and national numbers with IP-country precedence and GB fallback", async () => {
    const { defaultCountryFromHeaders, normalizePhone } =
      await import("@/lib/customer/phone")

    expect(
      defaultCountryFromHeaders(fixedHeaders({ "x-vercel-ip-country": "US" }))
    ).toBe("US")
    expect(
      defaultCountryFromHeaders(fixedHeaders({ "cf-ipcountry": "AU" }))
    ).toBe("AU")
    expect(
      defaultCountryFromHeaders(fixedHeaders({ "x-vercel-ip-country": "ZZ" }))
    ).toBe("GB")

    expect(normalizePhone("+447400123456", "US")).toMatchObject({
      ok: true,
      phone: { e164: "+447400123456", country: "GB", last4: "3456" },
    })
    expect(normalizePhone("07400 123456", "GB")).toMatchObject({
      ok: true,
      phone: { e164: "+447400123456", country: "GB", last4: "3456" },
    })
    expect(normalizePhone("(213) 373-4253", "US")).toMatchObject({
      ok: true,
      phone: { e164: "+12133734253", country: "US", last4: "4253" },
    })
    expect(normalizePhone("0400 123 456", "AU")).toMatchObject({
      ok: true,
      phone: { e164: "+61400123456", country: "AU", last4: "3456" },
    })
    expect(normalizePhone("9841234567", "NP")).toMatchObject({
      ok: true,
      phone: { e164: "+9779841234567", country: "NP", last4: "4567" },
    })
    expect(normalizePhone("123", "GB")).toEqual({
      ok: false,
      error: "Enter a valid phone number.",
    })
  })

  it("uses Twilio Verify start/check payloads and only accepts approved checks", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123"
    process.env.TWILIO_AUTH_TOKEN = "auth-token"
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123"
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "pending" }), { status: 201 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "approved" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "pending" }), { status: 200 })
      )
    vi.stubGlobal("fetch", fetchMock)
    const { checkCustomerPhoneVerification, startCustomerPhoneVerification } =
      await import("@/lib/customer/verification")

    await expect(
      startCustomerPhoneVerification("+12133734253")
    ).resolves.toEqual({
      status: "sent",
    })
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://verify.twilio.com/v2/Services/VA123/Verifications"
    )
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toBe(
      "To=%2B12133734253&Channel=sms"
    )

    await expect(
      checkCustomerPhoneVerification("+12133734253", "123456")
    ).resolves.toEqual({ status: "approved" })
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://verify.twilio.com/v2/Services/VA123/VerificationCheck"
    )
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toBe(
      "To=%2B12133734253&Code=123456"
    )

    await expect(
      checkCustomerPhoneVerification("+12133734253", "000000")
    ).resolves.toEqual({ status: "rejected" })
  })

  it("uses Twilio API key credentials when no auth token is configured", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123"
    process.env.TWILIO_API_KEY_SID = "SK123"
    process.env.TWILIO_API_KEY_SECRET = "api-key-secret"
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123"
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "pending" }), { status: 201 })
      )
    vi.stubGlobal("fetch", fetchMock)
    const { startCustomerPhoneVerification } =
      await import("@/lib/customer/verification")

    await expect(
      startCustomerPhoneVerification("+12133734253")
    ).resolves.toEqual({
      status: "sent",
    })
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("SK123:api-key-secret").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    })
  })

  it("rejects tampered and expired pending/session customer cookies", async () => {
    const {
      createCustomerSessionCookieValue,
      createPendingPhoneCookieValue,
      readCustomerSessionCookieValue,
      readPendingPhoneCookieValue,
    } = await import("@/lib/customer/session-cookie")
    const secret = "session-secret-with-enough-entropy"
    const now = 1_781_000_000
    const pending = createPendingPhoneCookieValue(
      {
        version: 1,
        purpose: "join",
        phone: "+447400123456",
        phoneHmac: "hmac-1",
        country: "GB",
        customerId: null,
        issuedAt: now,
        expiresAt: now + 600,
      },
      secret
    )
    const session = createCustomerSessionCookieValue(
      {
        version: 2,
        sessionId: "session-1",
        customerId: "customer-1",
        issuedAt: now,
        expiresAt: now + 2_592_000,
      },
      secret
    )

    expect(readPendingPhoneCookieValue(pending, secret, now + 1)).toMatchObject(
      {
        ok: true,
        payload: { phone: "+447400123456", purpose: "join" },
      }
    )
    expect(
      readCustomerSessionCookieValue(session, secret, now + 1)
    ).toMatchObject({
      ok: true,
      payload: { customerId: "customer-1", sessionId: "session-1" },
    })
    expect(
      readPendingPhoneCookieValue(`${pending.slice(0, -1)}x`, secret, now + 1)
    ).toEqual({ ok: false, reason: "invalid_signature" })
    expect(
      readCustomerSessionCookieValue(session, secret, now + 2_592_001)
    ).toEqual({
      ok: false,
      reason: "expired",
    })
  })

  it("starts join phone OTP through Twilio Verify without Supabase customer OTP", async () => {
    vi.resetModules()
    const signInWithOtp = vi.fn()
    const startCustomerPhoneVerification = vi.fn(async () => ({
      status: "sent",
    }))
    const setPendingPhoneVerification = vi.fn(async () => {})
    vi.doMock("next/headers", () => ({
      headers: vi.fn(async () => fixedHeaders({ "x-vercel-ip-country": "US" })),
    }))
    vi.doMock("@/lib/customer/verification", () => ({
      startCustomerPhoneVerification,
      checkCustomerPhoneVerification: vi.fn(),
    }))
    vi.doMock("@/lib/customer/session", () => ({
      clearPendingPhoneVerification: vi.fn(),
      getPendingPhoneVerification: vi.fn(),
      setCustomerSession: vi.fn(),
      setPendingPhoneVerification,
    }))
    vi.doMock("@/lib/customer/identity", () => ({
      getCurrentCustomer: vi.fn(),
      getOrCreateCustomerByVerifiedPhone: vi.fn(),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => ({
        auth: { signInWithOtp },
      })),
      createSupabaseServiceRoleClient: vi.fn(() => ({})),
    }))
    vi.doMock("@/lib/security/rate-limit", () => {
      class RateLimitError extends Error {}

      return {
        enforceRateLimit: vi.fn(async () => undefined),
        RateLimitError,
      }
    })
    vi.doMock("next/navigation", () => ({
      redirect: vi.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`)
      }),
    }))
    vi.doMock("@/lib/analytics/events", () => ({
      capturePostHogEvent: vi.fn(),
    }))
    const { requestCustomerIdentityAction } =
      await import("@/app/m/[merchantSlug]/join/actions")

    await expect(
      requestCustomerIdentityAction(
        {},
        form({
          contact: "(213) 373-4253",
          merchantSlug: "old-crown-girton",
          qrId: "old-crown-girton-qr",
        })
      )
    ).rejects.toThrow(
      "NEXT_REDIRECT:/m/old-crown-girton/join?qr=old-crown-girton-qr"
    )
    expect(startCustomerPhoneVerification).toHaveBeenCalledWith("+12133734253")
    expect(setPendingPhoneVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "join",
        phone: "+12133734253",
        country: "US",
      })
    )
    expect(signInWithOtp).not.toHaveBeenCalled()
  })

  it("keeps customer and home code request forms resendable after the first SMS", () => {
    const joinForms = readFileSync("components/customer/join-forms.tsx", "utf8")
    const joinOtpForm = readFileSync(
      "components/customer/join-otp-form.tsx",
      "utf8"
    )
    const customerLoginForm = readFileSync(
      "components/customer/customer-login-form.tsx",
      "utf8"
    )

    expect(joinOtpForm).toContain("CustomerOtpForm")
    expect(joinOtpForm).toContain('"Resend code"')
    expect(joinOtpForm).toContain("Sent to")
    expect(joinForms).toContain("CustomerIdentityForm")
    expect(customerLoginForm).toContain("otpSent")
    expect(customerLoginForm).toContain('"Resend code"')
    expect(customerLoginForm).not.toContain("requestPending || otpSent")
  })
})
