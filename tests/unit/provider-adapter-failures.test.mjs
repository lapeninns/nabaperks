import assert from "node:assert/strict"
import { createServer } from "node:http"
import { test } from "node:test"

import { sendTransactionalEmail } from "../../lib/notifications/resend.ts"
import { sendSmsOtp } from "../../lib/notifications/twilio.ts"

const originalFetch = globalThis.fetch
const maliciousBody =
  "TASK12_SECRET_SENTINEL customer.person@example.test +447700900999"

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
  server.closeAllConnections()
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

async function withProviderFixture(providerHostname, handler, run) {
  const server = createServer(handler)
  const baseUrl = await listen(server)
  globalThis.fetch = (input, init) => {
    assert.equal(new URL(input).hostname, providerHostname)
    return originalFetch(baseUrl, init)
  }

  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
    await close(server)
  }
}

function assertRedactedProviderError(error, expected) {
  assert.equal(error instanceof Error, true, "provider failure must be typed")
  assert.equal(error?.name, "ProviderRequestError")
  assert.equal(error?.provider, expected.provider)
  assert.equal(error?.status, expected.status)
  assert.equal(error?.code, expected.code)
  assert.equal(error?.message.includes(maliciousBody), false)
  assert.equal(error?.stack?.includes(maliciousBody) ?? false, false)
  assert.equal(JSON.stringify(error).includes(maliciousBody), false)
}

async function captureError(operation) {
  try {
    await operation()
  } catch (error) {
    return error
  }
  return undefined
}

function configureResend() {
  process.env.RESEND_API_KEY = "re_test_key"
  process.env.RESEND_FROM = "Nabaperks <hello@example.test>"
}

function configureTwilio() {
  process.env.TWILIO_ACCOUNT_SID = "AC_fixture"
  process.env.TWILIO_API_KEY_SID = "SK_fixture"
  process.env.TWILIO_API_KEY_SECRET = "secret_fixture"
  process.env.TWILIO_MESSAGING_SERVICE_SID = "MG_fixture"
}

test("Given a malicious Resend error body When transactional email is rejected Then only typed status metadata escapes", async () => {
  // Given
  configureResend()
  let error

  await withProviderFixture(
    "api.resend.com",
    (_request, response) => {
      response.writeHead(422, { "Content-Type": "text/plain" })
      response.end(maliciousBody)
    },
    async () => {
      // When
      error = await captureError(() =>
        sendTransactionalEmail({
          to: "recipient@example.test",
          subject: "Fixture",
          text: "Fixture",
          html: "<p>Fixture</p>",
        })
      )
    }
  )

  // Then
  assertRedactedProviderError(error, {
    provider: "resend",
    status: 422,
    code: "http_error",
  })
})

test("Given a malicious Twilio error body When an SMS is rejected Then only typed status metadata escapes", async () => {
  // Given
  configureTwilio()
  let error

  await withProviderFixture(
    "api.twilio.com",
    (_request, response) => {
      response.writeHead(429, { "Content-Type": "text/plain" })
      response.end(maliciousBody)
    },
    async () => {
      // When
      error = await captureError(() =>
        sendSmsOtp({ to: "+447700900123", code: "123456" })
      )
    }
  )

  // Then
  assertRedactedProviderError(error, {
    provider: "twilio",
    status: 429,
    code: "http_error",
  })
})

test("Given a never-ending Resend wire response When its deadline expires Then the exported adapter aborts", async () => {
  // Given
  configureResend()
  const watchdog = AbortSignal.timeout(300)

  await withProviderFixture(
    "api.resend.com",
    () => {},
    async () => {
      // When
      const error = await Promise.race([
        captureError(() =>
          sendTransactionalEmail(
            {
              to: "recipient@example.test",
              subject: "Fixture",
              text: "Fixture",
              html: "<p>Fixture</p>",
            },
            { timeoutMs: 40 }
          )
        ),
        new Promise((_, reject) =>
          watchdog.addEventListener(
            "abort",
            () => reject(new Error("Resend adapter exceeded watchdog")),
            { once: true }
          )
        ),
      ])

      // Then
      assertRedactedProviderError(error, {
        provider: "resend",
        status: null,
        code: "deadline_exceeded",
      })
    }
  )
})

test("Given a never-ending Twilio wire response When its deadline expires Then the exported adapter aborts", async () => {
  // Given
  configureTwilio()
  const watchdog = AbortSignal.timeout(300)

  await withProviderFixture(
    "api.twilio.com",
    () => {},
    async () => {
      // When
      const error = await Promise.race([
        captureError(() =>
          sendSmsOtp({ to: "+447700900123", code: "123456" }, { timeoutMs: 40 })
        ),
        new Promise((_, reject) =>
          watchdog.addEventListener(
            "abort",
            () => reject(new Error("Twilio adapter exceeded watchdog")),
            { once: true }
          )
        ),
      ])

      // Then
      assertRedactedProviderError(error, {
        provider: "twilio",
        status: null,
        code: "deadline_exceeded",
      })
    }
  )
})
