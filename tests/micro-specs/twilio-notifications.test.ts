import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Unit tests for the Twilio SMS OTP sender. The module POSTs to the Twilio
// Messages API through `resilientFetch`; we mock the global `fetch` rather than
// the resilience wrapper so the real URL/auth/body assembly is exercised. Twilio
// is configured through four env vars, set per-test and torn down afterwards.

const ENV_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_API_KEY_SID",
  "TWILIO_API_KEY_SECRET",
  "TWILIO_MESSAGING_SERVICE_SID",
] as const

const ACCOUNT_SID = "test-account-sid"
const API_KEY_SID = "test-api-key-sid"
const API_KEY_SECRET = "super-secret-key-value"
const MESSAGING_SERVICE_SID = "test-messaging-service-sid"

function configureTwilio() {
  process.env.TWILIO_ACCOUNT_SID = ACCOUNT_SID
  process.env.TWILIO_API_KEY_SID = API_KEY_SID
  process.env.TWILIO_API_KEY_SECRET = API_KEY_SECRET
  process.env.TWILIO_MESSAGING_SERVICE_SID = MESSAGING_SERVICE_SID
}

describe("sendSmsOtp", () => {
  beforeEach(() => {
    configureTwilio()
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    for (const key of ENV_KEYS) delete process.env[key]
  })

  it("POSTs the code to the account's Twilio Messages endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 201 }))
    vi.stubGlobal("fetch", fetchMock)

    const { sendSmsOtp } = await import("@/lib/notifications/twilio")
    await sendSmsOtp({ to: "+447700900123", code: "246810" })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`
    )
    expect(init.method).toBe("POST")
  })

  it("authenticates with Basic auth built from the API key SID and secret", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { sendSmsOtp } = await import("@/lib/notifications/twilio")
    await sendSmsOtp({ to: "+447700900123", code: "112233" })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    const expected = Buffer.from(`${API_KEY_SID}:${API_KEY_SECRET}`).toString(
      "base64"
    )
    expect(headers.Authorization).toBe(`Basic ${expected}`)
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded")
  })

  it("sends a form body carrying the messaging service SID, recipient and code", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 201 }))
    vi.stubGlobal("fetch", fetchMock)

    const { sendSmsOtp } = await import("@/lib/notifications/twilio")
    await sendSmsOtp({ to: "+447700900456", code: "987654" })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = new URLSearchParams(init.body as string)
    expect(body.get("To")).toBe("+447700900456")
    expect(body.get("MessagingServiceSid")).toBe(MESSAGING_SERVICE_SID)
    expect(body.get("Body")).toBe("Your Nabaperks verification code is 987654")
  })

  it("throws and surfaces the status and detail when Twilio rejects the send", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("Twilio rejected the recipient", { status: 400 })
      )
    vi.stubGlobal("fetch", fetchMock)

    const { sendSmsOtp } = await import("@/lib/notifications/twilio")

    await expect(
      sendSmsOtp({ to: "+447700900789", code: "555000" })
    ).rejects.toThrow(
      /Twilio send failed \(400\): Twilio rejected the recipient/
    )
    // A 4xx is returned by the resilience layer without retrying, so the
    // upstream is called exactly once.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("throws without calling Twilio when configuration is incomplete", async () => {
    delete process.env.TWILIO_MESSAGING_SERVICE_SID
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { sendSmsOtp } = await import("@/lib/notifications/twilio")

    await expect(
      sendSmsOtp({ to: "+447700900123", code: "424242" })
    ).rejects.toThrow(/Twilio is not configured/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("trims surrounding whitespace from configured credentials", async () => {
    process.env.TWILIO_ACCOUNT_SID = `  ${ACCOUNT_SID}  `
    process.env.TWILIO_API_KEY_SID = `\t${API_KEY_SID}\n`
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { sendSmsOtp } = await import("@/lib/notifications/twilio")
    await sendSmsOtp({ to: "+447700900123", code: "131313" })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    const expected = Buffer.from(`${API_KEY_SID}:${API_KEY_SECRET}`).toString(
      "base64"
    )
    expect(url).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`
    )
    expect(headers.Authorization).toBe(`Basic ${expected}`)
  })
})
