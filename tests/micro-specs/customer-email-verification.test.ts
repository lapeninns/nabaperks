import { createHmac } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createPendingEmailCookieValue,
  readPendingEmailCookieValue,
  type PendingEmailPayload,
} from "@/lib/customer/session-cookie"

const SECRET = "test-customer-session-secret"

/** Mirrors emailCodeHmac() so tests can build pending payloads without importing
 *  the module before its mocks are installed. */
function hmac(email: string, code: string): string {
  return createHmac("sha256", SECRET)
    .update(`${email.trim().toLowerCase()}:${code}`)
    .digest("hex")
}

function pendingEmail(
  overrides: Partial<PendingEmailPayload> = {}
): PendingEmailPayload {
  return {
    version: 1,
    email: "sam@example.test",
    codeHmac: "deadbeef",
    issuedAt: 1000,
    expiresAt: 2000,
    ...overrides,
  }
}

describe("pending email cookie", () => {
  it("round-trips a signed payload", () => {
    const value = createPendingEmailCookieValue(pendingEmail(), SECRET)
    const result = readPendingEmailCookieValue(value, SECRET, 1500)
    expect(result).toEqual({ ok: true, payload: pendingEmail() })
  })

  it("rejects a tampered signature", () => {
    const value = createPendingEmailCookieValue(pendingEmail(), SECRET)
    const result = readPendingEmailCookieValue(value, "other-secret", 1500)
    expect(result.ok).toBe(false)
  })

  it("rejects an expired payload", () => {
    const value = createPendingEmailCookieValue(pendingEmail(), SECRET)
    const result = readPendingEmailCookieValue(value, SECRET, 2001)
    expect(result).toMatchObject({ ok: false, reason: "expired" })
  })
})

describe("customer email verification", () => {
  beforeEach(() => {
    process.env.CUSTOMER_SESSION_SECRET = SECRET
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.CUSTOMER_SESSION_SECRET
    delete process.env.CUSTOMER_DEV_OTP_CODE
  })

  it("emails a six-digit code and stores its bound HMAC", async () => {
    const setPending =
      vi.fn<(input: { email: string; codeHmac: string }) => Promise<void>>()
    const sendEmailOtp =
      vi.fn<(args: { to: string; code: string }) => Promise<void>>()
    vi.doMock("@/lib/customer/session", () => ({
      setPendingEmailVerification: setPending,
      getPendingEmailVerification: vi.fn(),
      clearPendingEmailVerification: vi.fn(),
    }))
    vi.doMock("@/lib/notifications/resend", () => ({ sendEmailOtp }))

    const { startCustomerEmailVerification, emailCodeHmac } = await import(
      "@/lib/customer/email-verification"
    )

    await expect(
      startCustomerEmailVerification("Sam@Example.test")
    ).resolves.toEqual({ status: "sent" })

    const sent = sendEmailOtp.mock.calls[0]?.[0]
    expect(sent?.to).toBe("Sam@Example.test")
    expect(sent?.code).toMatch(/^\d{6}$/)

    const stored = setPending.mock.calls[0]?.[0]
    expect(stored?.email).toBe("Sam@Example.test")
    // The stored HMAC binds the address + code, regardless of case.
    const code = sent?.code ?? ""
    expect(stored?.codeHmac).toBe(emailCodeHmac("Sam@Example.test", code))
    expect(stored?.codeHmac).toBe(hmac("Sam@Example.test", code))
  })

  it("approves the code that matches the pending HMAC and clears the cookie", async () => {
    const code = "135790"
    const clearPending = vi.fn(async () => {})
    vi.doMock("@/lib/customer/session", () => ({
      setPendingEmailVerification: vi.fn(),
      getPendingEmailVerification: vi.fn(async () => ({
        version: 1,
        email: "sam@example.test",
        codeHmac: hmac("sam@example.test", code),
        issuedAt: 0,
        expiresAt: 0,
      })),
      clearPendingEmailVerification: clearPending,
    }))
    vi.doMock("@/lib/notifications/resend", () => ({ sendEmailOtp: vi.fn() }))

    const { checkCustomerEmailVerification } = await import(
      "@/lib/customer/email-verification"
    )

    await expect(checkCustomerEmailVerification(code)).resolves.toEqual({
      status: "approved",
      email: "sam@example.test",
    })
    expect(clearPending).toHaveBeenCalledOnce()
  })

  it("rejects a code that does not match", async () => {
    vi.doMock("@/lib/customer/session", () => ({
      setPendingEmailVerification: vi.fn(),
      getPendingEmailVerification: vi.fn(async () => ({
        version: 1,
        email: "sam@example.test",
        codeHmac: hmac("sam@example.test", "111111"),
        issuedAt: 0,
        expiresAt: 0,
      })),
      clearPendingEmailVerification: vi.fn(),
    }))
    vi.doMock("@/lib/notifications/resend", () => ({ sendEmailOtp: vi.fn() }))

    const { checkCustomerEmailVerification } = await import(
      "@/lib/customer/email-verification"
    )

    await expect(checkCustomerEmailVerification("999999")).resolves.toEqual({
      status: "rejected",
    })
  })

  it("rejects when there is no pending verification", async () => {
    vi.doMock("@/lib/customer/session", () => ({
      setPendingEmailVerification: vi.fn(),
      getPendingEmailVerification: vi.fn(async () => null),
      clearPendingEmailVerification: vi.fn(),
    }))
    vi.doMock("@/lib/notifications/resend", () => ({ sendEmailOtp: vi.fn() }))

    const { checkCustomerEmailVerification } = await import(
      "@/lib/customer/email-verification"
    )

    await expect(checkCustomerEmailVerification("123456")).resolves.toEqual({
      status: "rejected",
    })
  })

  it("approves the configured dev code without matching the HMAC", async () => {
    process.env.CUSTOMER_DEV_OTP_CODE = "424242"
    vi.doMock("@/lib/customer/session", () => ({
      setPendingEmailVerification: vi.fn(),
      getPendingEmailVerification: vi.fn(async () => ({
        version: 1,
        email: "sam@example.test",
        codeHmac: "not-the-real-hmac",
        issuedAt: 0,
        expiresAt: 0,
      })),
      clearPendingEmailVerification: vi.fn(),
    }))
    vi.doMock("@/lib/notifications/resend", () => ({ sendEmailOtp: vi.fn() }))

    const { checkCustomerEmailVerification } = await import(
      "@/lib/customer/email-verification"
    )

    await expect(checkCustomerEmailVerification("424242")).resolves.toEqual({
      status: "approved",
      email: "sam@example.test",
    })
  })
})
