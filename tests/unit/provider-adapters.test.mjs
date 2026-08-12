import assert from "node:assert/strict"
import { createServer } from "node:http"
import { test } from "node:test"

import { sendTransactionalEmail } from "../../lib/notifications/resend.ts"
import { sendSmsOtp } from "../../lib/notifications/twilio.ts"

const originalFetch = globalThis.fetch

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("loopback server did not expose a TCP address"))
        return
      }
      resolve(`http://127.0.0.1:${address.port}`)
    })
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

function readRequest(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on("data", (chunk) => chunks.push(chunk))
    request.on("end", () =>
      resolve({
        method: request.method,
        headers: request.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      })
    )
    request.on("error", reject)
  })
}

async function withProviderFixture(providerHostname, handler, run) {
  const server = createServer(handler)
  const baseUrl = await listen(server)
  globalThis.fetch = (input, init) => {
    const providerUrl = new URL(input)
    assert.equal(providerUrl.hostname, providerHostname)
    return originalFetch(baseUrl, init)
  }

  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
    await close(server)
  }
}

test("Given a successful Resend wire response When transactional email is sent Then the adapter preserves its success contract", async () => {
  // Given
  const previousApiKey = process.env.RESEND_API_KEY
  const previousFrom = process.env.RESEND_FROM
  process.env.RESEND_API_KEY = "re_test_key"
  process.env.RESEND_FROM = "Nabaperks <hello@example.test>"
  let capturedRequest

  try {
    await withProviderFixture(
      "api.resend.com",
      async (request, response) => {
        capturedRequest = await readRequest(request)
        response.writeHead(200, { "Content-Type": "application/json" })
        response.end('{"id":"email_fixture"}')
      },
      async () => {
        // When
        const result = await sendTransactionalEmail({
          to: "recipient@example.test",
          subject: "Fixture subject",
          text: "Fixture text",
          html: "<p>Fixture</p>",
        })

        // Then
        assert.equal(result, undefined)
      }
    )

    assert.equal(capturedRequest?.method, "POST")
    assert.equal(capturedRequest?.headers.authorization, "Bearer re_test_key")
    assert.deepEqual(JSON.parse(capturedRequest?.body ?? "{}").to, [
      "recipient@example.test",
    ])
  } finally {
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = previousApiKey
    if (previousFrom === undefined) delete process.env.RESEND_FROM
    else process.env.RESEND_FROM = previousFrom
  }
})

test("Given a successful Twilio wire response When an SMS OTP is sent Then the adapter preserves its success contract", async () => {
  // Given
  const previous = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    apiKeySid: process.env.TWILIO_API_KEY_SID,
    apiKeySecret: process.env.TWILIO_API_KEY_SECRET,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  }
  process.env.TWILIO_ACCOUNT_SID = "AC_fixture"
  process.env.TWILIO_API_KEY_SID = "SK_fixture"
  process.env.TWILIO_API_KEY_SECRET = "secret_fixture"
  process.env.TWILIO_MESSAGING_SERVICE_SID = "MG_fixture"
  let capturedRequest

  try {
    await withProviderFixture(
      "api.twilio.com",
      async (request, response) => {
        capturedRequest = await readRequest(request)
        response.writeHead(201, { "Content-Type": "application/json" })
        response.end('{"sid":"SM_fixture"}')
      },
      async () => {
        // When
        const result = await sendSmsOtp({ to: "+447700900123", code: "123456" })

        // Then
        assert.equal(result, undefined)
      }
    )

    assert.equal(capturedRequest?.method, "POST")
    assert.match(capturedRequest?.headers.authorization ?? "", /^Basic /)
    const params = new URLSearchParams(capturedRequest?.body)
    assert.equal(params.get("To"), "+447700900123")
    assert.equal(params.get("MessagingServiceSid"), "MG_fixture")
    assert.match(params.get("Body") ?? "", /123456/)
  } finally {
    const restore = (name, value) => {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    restore("TWILIO_ACCOUNT_SID", previous.accountSid)
    restore("TWILIO_API_KEY_SID", previous.apiKeySid)
    restore("TWILIO_API_KEY_SECRET", previous.apiKeySecret)
    restore("TWILIO_MESSAGING_SERVICE_SID", previous.messagingServiceSid)
  }
})
