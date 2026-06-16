import { readFileSync } from "node:fs"

import { afterEach, describe, expect, it, vi } from "vitest"

function form(values: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value)
  }

  return data
}

function readProjectFile(path: string): string {
  return readFileSync(path, "utf8")
}

describe("customer home auth", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("next/headers")
    vi.doUnmock("next/navigation")
    vi.doUnmock("@/lib/customer/identity")
    vi.doUnmock("@/lib/customer/phone")
    vi.doUnmock("@/lib/customer/session")
    vi.doUnmock("@/lib/customer/verification")
    vi.doUnmock("@/lib/security/rate-limit")
  })

  it("redirects OTP verification to the submitted safe next path", async () => {
    const redirect = vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`)
    })
    const setCustomerSession = vi.fn(async () => undefined)
    const clearPendingPhoneVerification = vi.fn(async () => undefined)

    vi.doMock("next/headers", () => ({
      headers: vi.fn(async () => new Headers()),
    }))
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("@/lib/customer/identity", () => ({
      findCustomerByVerifiedPhone: vi.fn(),
    }))
    vi.doMock("@/lib/customer/phone", () => ({
      defaultCountryFromHeaders: vi.fn(() => "GB"),
      normalizePhone: vi.fn(),
    }))
    vi.doMock("@/lib/customer/session", () => ({
      clearCustomerSession: vi.fn(),
      clearPendingPhoneVerification,
      getPendingPhoneVerification: vi.fn(async () => ({
        purpose: "wallet",
        phone: "+447400123456",
        country: "GB",
        customerId: "customer-1",
        issuedAt: 1,
        expiresAt: 2,
      })),
      setCustomerSession,
      setPendingPhoneVerification: vi.fn(),
    }))
    vi.doMock("@/lib/customer/verification", () => ({
      checkCustomerPhoneVerification: vi.fn(async () => ({ status: "approved" })),
      startCustomerPhoneVerification: vi.fn(),
    }))
    vi.doMock("@/lib/security/rate-limit", () => ({
      RateLimitError: class RateLimitError extends Error {},
      enforceRateLimit: vi.fn(async () => undefined),
    }))

    const { verifyCustomerLoginOtpAction } = await import("@/app/home/actions")

    await expect(
      verifyCustomerLoginOtpAction(
        {},
        form({ otp: "123456", next: "/home/profile" })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/home/profile")

    expect(setCustomerSession).toHaveBeenCalledWith("customer-1")
    expect(clearPendingPhoneVerification).toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith("/home/profile")
  })

  it("keeps customer home auth return-path wiring in place", () => {
    const layout = readProjectFile("app/home/(authed)/layout.tsx")
    const loginPage = readProjectFile("app/home/login/page.tsx")
    const loginForm = readProjectFile(
      "components/customer/customer-login-form.tsx"
    )
    const proxy = readProjectFile("proxy.ts")
    const requestPath = readProjectFile("lib/navigation/request-path.ts")
    const sessionResetRoute = readProjectFile("app/home/session/reset/route.ts")

    expect(layout).toContain("customerLoginHref")
    expect(layout).toContain("customerSessionResetHref")
    expect(layout).toContain("readRequestPath")
    expect(sessionResetRoute).toContain("clearCustomerSession")
    expect(sessionResetRoute).toContain("customerLoginHref")
    expect(loginPage).toContain("safeNextPath")
    expect(loginPage).toContain("next={next}")
    expect(loginForm).toContain('type="hidden"')
    expect(loginForm).toContain('name="next"')
    expect(requestPath).toContain('REQUEST_PATH_HEADER = "x-nabaperks-path"')
    expect(proxy).toContain("REQUEST_PATH_HEADER")
  })
})
