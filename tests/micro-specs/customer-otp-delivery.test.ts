import { createHmac } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"

import { verifyStandardWebhook } from "@/lib/notifications/standard-webhook"

const SECRET = "whsec_" + Buffer.from("nabaperks-otp-hook-test-secret").toString("base64")

function nowSec() {
  return Math.floor(Date.now() / 1000)
}

function sign(secret: string, id: string, ts: string, body: string) {
  const key = Buffer.from(secret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64")
  return createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")
}

function signedRequest(url: string, body: string, secret = SECRET) {
  const id = "msg_test"
  const ts = String(nowSec())
  const sig = sign(secret, id, ts, body)
  return new Request(url, {
    method: "POST",
    headers: {
      "webhook-id": id,
      "webhook-timestamp": ts,
      "webhook-signature": `v1,${sig}`,
    },
    body,
  })
}

describe("auth hook OTP delivery (Resend email + legacy Twilio SMS)", () => {
  describe("verifyStandardWebhook", () => {
    it("accepts a correctly signed payload", () => {
      const id = "m1"
      const ts = String(nowSec())
      const body = JSON.stringify({ user: { email: "a@b.test" } })
      expect(
        verifyStandardWebhook({
          secret: SECRET,
          id,
          timestamp: ts,
          body,
          signatureHeader: `v1,${sign(SECRET, id, ts, body)}`,
        })
      ).toBe(true)
    })

    it("rejects a tampered body", () => {
      const id = "m1"
      const ts = String(nowSec())
      const body = JSON.stringify({ user: { email: "a@b.test" } })
      const sig = sign(SECRET, id, ts, body)
      expect(
        verifyStandardWebhook({
          secret: SECRET,
          id,
          timestamp: ts,
          body: body + "tampered",
          signatureHeader: `v1,${sig}`,
        })
      ).toBe(false)
    })

    it("rejects a stale timestamp outside the tolerance window", () => {
      const id = "m1"
      const ts = String(nowSec() - 3600)
      const body = "{}"
      expect(
        verifyStandardWebhook({
          secret: SECRET,
          id,
          timestamp: ts,
          body,
          signatureHeader: `v1,${sign(SECRET, id, ts, body)}`,
        })
      ).toBe(false)
    })

    it("rejects when the secret is missing", () => {
      expect(
        verifyStandardWebhook({
          secret: "",
          id: "m1",
          timestamp: String(nowSec()),
          body: "{}",
          signatureHeader: "v1,whatever",
        })
      ).toBe(false)
    })
  })

  describe("send-email hook route", () => {
    const ENV = "SUPABASE_SEND_EMAIL_HOOK_SECRET"
    const URL = "http://localhost/api/auth/hooks/send-email"

    afterEach(() => {
      vi.resetModules()
      vi.clearAllMocks()
      delete process.env[ENV]
    })

    it("returns 500 when the hook secret is not configured", async () => {
      vi.resetModules()
      delete process.env[ENV]
      const sendEmailOtp = vi.fn()
      vi.doMock("@/lib/notifications/resend", () => ({ sendEmailOtp }))
      const { POST } = await import("@/app/api/auth/hooks/send-email/route")

      const res = await POST(
        new Request(URL, { method: "POST", body: "{}" }) as never
      )

      expect(res.status).toBe(500)
      expect(sendEmailOtp).not.toHaveBeenCalled()
    })

    it("rejects an invalid signature with 401", async () => {
      vi.resetModules()
      process.env[ENV] = SECRET
      const sendEmailOtp = vi.fn()
      vi.doMock("@/lib/notifications/resend", () => ({ sendEmailOtp }))
      const { POST } = await import("@/app/api/auth/hooks/send-email/route")

      const body = JSON.stringify({
        user: { email: "a@b.test" },
        email_data: { token: "123456" },
      })
      const res = await POST(
        new Request(URL, {
          method: "POST",
          headers: {
            "webhook-id": "m1",
            "webhook-timestamp": String(nowSec()),
            "webhook-signature": "v1,bogus",
          },
          body,
        }) as never
      )

      expect(res.status).toBe(401)
      expect(sendEmailOtp).not.toHaveBeenCalled()
    })

    it("delivers the code via Resend on a valid signed request", async () => {
      vi.resetModules()
      process.env[ENV] = SECRET
      const sendEmailOtp = vi.fn(async () => {})
      vi.doMock("@/lib/notifications/resend", () => ({ sendEmailOtp }))
      const { POST } = await import("@/app/api/auth/hooks/send-email/route")

      const body = JSON.stringify({
        user: { email: "Guest@B.test" },
        email_data: { token: "123456", email_action_type: "magiclink" },
      })
      const res = await POST(signedRequest(URL, body) as never)

      expect(res.status).toBe(200)
      expect(sendEmailOtp).toHaveBeenCalledWith({ to: "Guest@B.test", code: "123456" })
    })

    it("returns 400 when the code is missing", async () => {
      vi.resetModules()
      process.env[ENV] = SECRET
      const sendEmailOtp = vi.fn()
      vi.doMock("@/lib/notifications/resend", () => ({ sendEmailOtp }))
      const { POST } = await import("@/app/api/auth/hooks/send-email/route")

      const body = JSON.stringify({ user: { email: "a@b.test" }, email_data: {} })
      const res = await POST(signedRequest(URL, body) as never)

      expect(res.status).toBe(400)
      expect(sendEmailOtp).not.toHaveBeenCalled()
    })
  })

  describe("send-sms hook route", () => {
    const ENV = "SUPABASE_SEND_SMS_HOOK_SECRET"
    const URL = "http://localhost/api/auth/hooks/send-sms"

    afterEach(() => {
      vi.resetModules()
      vi.clearAllMocks()
      delete process.env[ENV]
    })

    it("delivers the code via Twilio on a valid signed request", async () => {
      vi.resetModules()
      process.env[ENV] = SECRET
      const sendSmsOtp = vi.fn(async () => {})
      vi.doMock("@/lib/notifications/twilio", () => ({ sendSmsOtp }))
      const { POST } = await import("@/app/api/auth/hooks/send-sms/route")

      const body = JSON.stringify({
        user: { phone: "+447700900000" },
        sms: { otp: "654321" },
      })
      const res = await POST(signedRequest(URL, body) as never)

      expect(res.status).toBe(200)
      expect(sendSmsOtp).toHaveBeenCalledWith({ to: "+447700900000", code: "654321" })
    })

    it("rejects an invalid signature with 401", async () => {
      vi.resetModules()
      process.env[ENV] = SECRET
      const sendSmsOtp = vi.fn()
      vi.doMock("@/lib/notifications/twilio", () => ({ sendSmsOtp }))
      const { POST } = await import("@/app/api/auth/hooks/send-sms/route")

      const body = JSON.stringify({
        user: { phone: "+447700900000" },
        sms: { otp: "654321" },
      })
      const res = await POST(
        new Request(URL, {
          method: "POST",
          headers: {
            "webhook-id": "m2",
            "webhook-timestamp": String(nowSec()),
            "webhook-signature": "v1,nope",
          },
          body,
        }) as never
      )

      expect(res.status).toBe(401)
      expect(sendSmsOtp).not.toHaveBeenCalled()
    })
  })
})
