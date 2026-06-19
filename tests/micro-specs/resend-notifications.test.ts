import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { sendEmailOtp } from "@/lib/notifications/resend"

const RESEND_ENDPOINT = "https://api.resend.com/emails"

function okResponse() {
  return new Response(JSON.stringify({ id: "email-id" }), { status: 200 })
}

describe("sendEmailOtp (Resend transactional email)", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key"
    process.env.RESEND_FROM = "My Nabaperks <login@nabaperks.test>"
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM
  })

  it("POSTs the code to the Resend emails endpoint with bearer auth and a JSON body", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    await sendEmailOtp({ to: "guest@nabaperks.test", code: "123456" })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(RESEND_ENDPOINT)

    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.method).toBe("POST")
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer re_test_key",
      "Content-Type": "application/json",
    })

    const body = JSON.parse(String(init?.body)) as {
      from: string
      to: string[]
      subject: string
      text: string
      html: string
    }
    expect(body.from).toBe("My Nabaperks <login@nabaperks.test>")
    expect(body.to).toEqual(["guest@nabaperks.test"])
    expect(body.subject).toBe("123456 is your Nabaperks code")
    expect(body.text).toContain("123456")
    expect(body.html).toContain("123456")
  })

  it("trims surrounding whitespace from the configured key and sender", async () => {
    process.env.RESEND_API_KEY = "  re_trimmed_key  "
    process.env.RESEND_FROM = "  Nabaperks <hello@nabaperks.test>  "
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    await sendEmailOtp({ to: "guest@nabaperks.test", code: "654321" })

    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer re_trimmed_key",
    })
    const body = JSON.parse(String(init?.body)) as { from: string }
    expect(body.from).toBe("Nabaperks <hello@nabaperks.test>")
  })

  it("surfaces a non-ok Resend response as an error including the status and detail", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("validation failed: invalid recipient", { status: 422 })
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      sendEmailOtp({ to: "broken@nabaperks.test", code: "111222" })
    ).rejects.toThrow(/Resend send failed \(422\): validation failed/)

    // A 4xx is a client error, so the resilient fetch must not retry it.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("throws without calling fetch when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      sendEmailOtp({ to: "guest@nabaperks.test", code: "123456" })
    ).rejects.toThrow(/Resend is not configured/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("throws without calling fetch when RESEND_FROM is missing", async () => {
    delete process.env.RESEND_FROM
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      sendEmailOtp({ to: "guest@nabaperks.test", code: "123456" })
    ).rejects.toThrow(/Resend is not configured/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
