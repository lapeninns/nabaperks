import assert from "node:assert/strict"
import { test } from "node:test"
import { scan } from "../support/public-qr-page.mjs"

const LIVE_QR = {
  available: true,
  qrId: "old-crown-bar",
  merchant: { id: "merchant-1", business_slug: "old-crown" },
}

test("Given a signed-in member When the membership lookup fails Then the scan carries on to the join flow and the failure is logged", async () => {
  const answer = await scan({
    resolve: async () => LIVE_QR,
    membership: async () => {
      throw new Error("Unable to load membership: connection reset")
    },
  })

  assert.match(answer.redirect ?? "", /^\/m\/old-crown\/join\?/)
  assert.equal(answer.logs.length, 1)
  assert.equal(answer.logs[0].level, "error")
  assert.equal(answer.logs[0].fields.stage, "membership_lookup")
  assert.equal(answer.logs[0].fields.requestId, "req-0123456789abcdef")
  assert.doesNotMatch(
    JSON.stringify(answer.logs[0]),
    /connection reset|198\.51\.100\.9/,
    "the log line carries no error message or client address"
  )
})

test("Given the database is unreachable When the QR is scanned Then the page asks for a retry instead of blaming the QR", async () => {
  const answer = await scan({
    resolve: async () => {
      throw new TypeError("fetch failed")
    },
    membership: async () => null,
  })

  assert.equal(answer.redirect, undefined)
  assert.doesNotMatch(answer.text, /This QR isn't working/)
  assert.doesNotMatch(answer.text, /current loyalty QR/)
  assert.match(answer.text, /We couldn't load this card/)
  assert.match(answer.text, /Check your signal or Wi-Fi, then try again\./)
  assert.match(answer.text, /Try again/)
  assert.deepEqual(
    answer.logs.map(({ event, fields }) => ({
      event,
      stage: fields.stage,
      reason: fields.reason,
    })),
    [
      {
        event: "customer_qr_entry_failed",
        stage: "resolve",
        reason: "TypeError",
      },
    ]
  )
})

test("Given an inactive QR When it is scanned Then it is still reported as unavailable", async () => {
  const answer = await scan({
    resolve: async () => ({ ...LIVE_QR, available: false }),
    membership: async () => null,
  })

  assert.match(answer.text, /This QR isn't working/)
  assert.match(
    answer.text,
    /Ask a member of staff for the current loyalty QR\./
  )
  assert.deepEqual(answer.logs, [])
})

test("Given a paused QR When it is scanned Then the receipt explains the pause without entering membership or stamp flows", async () => {
  const answer = await scan({
    resolve: async () => ({ ...LIVE_QR, available: false, qrPaused: true }),
    membership: async () => {
      throw new Error("A paused QR must not look up membership")
    },
  })

  assert.equal(answer.redirect, undefined)
  assert.match(answer.text, /paused/i)
  assert.doesNotMatch(answer.text, /This QR isn't working|Today's stamp/)
  assert.match(answer.text, /Open my cards/)
  assert.deepEqual(answer.logs, [])
})

test("Given a signed-out visitor When a live QR is scanned Then they go to the join flow", async () => {
  const answer = await scan({
    resolve: async () => LIVE_QR,
    membership: async () => null,
  })

  assert.match(answer.redirect ?? "", /^\/m\/old-crown\/join\?/)
  assert.deepEqual(answer.logs, [])
})
