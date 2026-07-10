import assert from "node:assert/strict"
import { test } from "node:test"

import { createFunnelCaptureQueue } from "@/lib/analytics/funnel-capture-queue"

test("queued funnel captures read continuity from current session storage", async () => {
  let releaseFirstCapture
  const firstCaptureBlocked = new Promise((resolve) => {
    releaseFirstCapture = resolve
  })
  let markFirstCaptureStarted
  const firstCaptureStarted = new Promise((resolve) => {
    markFirstCaptureStarted = resolve
  })
  let currentSessionToken = "session-token-one"
  const requests = []
  let captureCount = 0

  const queue = createFunnelCaptureQueue({
    readToken: () => currentSessionToken,
    rememberToken: (token) => {
      currentSessionToken = token
      return true
    },
    postCapture: async (event, token) => {
      requests.push({ event, token })
      captureCount += 1
      if (captureCount === 1) {
        markFirstCaptureStarted()
        await firstCaptureBlocked
        return null
      }
      return { token: token ?? "session-token-two" }
    },
  })

  const first = queue.capture("merchant_marketing_viewed")
  await firstCaptureStarted
  const second = queue.capture("merchant_signup_clicked")

  currentSessionToken = null
  releaseFirstCapture()
  await Promise.all([first, second])

  assert.deepEqual(requests, [
    {
      event: "merchant_marketing_viewed",
      token: "session-token-one",
    },
    {
      event: "merchant_signup_clicked",
      token: null,
    },
    {
      event: "merchant_signup_clicked",
      token: "session-token-two",
    },
  ])
  assert.equal(currentSessionToken, "session-token-two")
})
