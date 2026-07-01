import assert from "node:assert/strict"
import { test } from "node:test"

import fc from "fast-check"

import { normalizeScannedQrDestination } from "@/lib/customer/qr-scanner"
import { normalizeScannedRewardDestination } from "@/lib/merchant/reward-scanner"

const ORIGIN = "https://app.nabaperks.test"
const QR_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-".split("")

const qrIdArbitrary = fc
  .array(fc.constantFrom(...QR_CHARS), { minLength: 1, maxLength: 48 })
  .map((chars) => chars.join(""))

test("Given arbitrary valid QR ids When normalized Then the href is canonical and idempotent", () => {
  fc.assert(
    fc.property(qrIdArbitrary, (qrId) => {
      const payload = `${ORIGIN}/q/${qrId}?utm=ignored#section`
      const first = normalizeScannedQrDestination(payload, ORIGIN)
      const second = normalizeScannedQrDestination(payload, ORIGIN)

      assert.deepEqual(first, { kind: "valid", href: `/q/${qrId}` })
      assert.deepEqual(second, first)
    }),
    { numRuns: 100 }
  )
})

test("Given arbitrary reward tokens When normalized Then the href is canonical and idempotent", () => {
  fc.assert(
    fc.property(fc.uuid(), (token) => {
      const payload = `${ORIGIN}/r/${token}?utm=ignored#section`
      const first = normalizeScannedRewardDestination(payload, ORIGIN)
      const second = normalizeScannedRewardDestination(payload, ORIGIN)

      assert.deepEqual(first, {
        kind: "valid",
        href: `/app/rewards/scan/${token}`,
      })
      assert.deepEqual(second, first)
    }),
    { numRuns: 100 }
  )
})

test("Given arbitrary cross-origin values When normalized Then scanners reject them", () => {
  fc.assert(
    fc.property(qrIdArbitrary, fc.uuid(), (qrId, token) => {
      assert.deepEqual(
        normalizeScannedQrDestination(`https://evil.example/q/${qrId}`, ORIGIN),
        { kind: "invalid" }
      )
      assert.deepEqual(
        normalizeScannedRewardDestination(
          `https://evil.example/r/${token}`,
          ORIGIN
        ),
        { kind: "invalid" }
      )
    }),
    { numRuns: 100 }
  )
})
