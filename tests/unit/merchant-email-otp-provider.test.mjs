import assert from "node:assert/strict"
import { test } from "node:test"

import {
  classifyMerchantOtpProviderOutcome,
  runMerchantOtpDelivery,
  runMerchantOtpProviderVerification,
} from "@/lib/auth/merchant-email-otp-provider"

test("delivery failure revokes only the just-created alias and scrubs its token", async () => {
  const rows = new Map([
    ["recovery-alias", { resolution: null, token: "encrypted-recovery-token" }],
  ])
  const createdAlias = { aliasCode: "615001", aliasId: "signup-alias" }
  let sentCode = null

  await assert.rejects(
    runMerchantOtpDelivery({
      createAlias: async () => {
        rows.set(createdAlias.aliasId, {
          resolution: null,
          token: "encrypted-signup-token",
        })
        return createdAlias
      },
      revokeAlias: async (aliasId) => {
        const row = rows.get(aliasId)
        if (!row || row.resolution !== null) return false
        row.resolution = "delivery_failed"
        row.token = ""
        return true
      },
      sendAlias: async (aliasCode) => {
        sentCode = aliasCode
        throw new Error("Resend unavailable")
      },
    }),
    /Resend unavailable/
  )

  assert.equal(sentCode, createdAlias.aliasCode)
  assert.deepEqual(rows.get(createdAlias.aliasId), {
    resolution: "delivery_failed",
    token: "",
  })
  assert.deepEqual(rows.get("recovery-alias"), {
    resolution: null,
    token: "encrypted-recovery-token",
  })
})

test("ambiguous delivery acceptance keeps the alias live for the delivered code", async () => {
  let revoked = false
  const ambiguous = new TypeError("response lost")

  await assert.rejects(
    runMerchantOtpDelivery({
      createAlias: async () => ({ aliasCode: "615001", aliasId: "alias-1" }),
      revokeAlias: async () => {
        revoked = true
        return true
      },
      sendAlias: async () => {
        throw ambiguous
      },
      shouldRevokeAfterSendError: () => false,
    }),
    ambiguous
  )

  assert.equal(revoked, false)
})

test("provider success finalizes verified and never releases", async () => {
  const calls = []
  const result = await runMerchantOtpProviderVerification({
    finalize: async (outcome) => {
      calls.push(`finalize:${outcome}`)
      return true
    },
    release: async () => {
      calls.push("release")
      return true
    },
    verify: async () => ({ error: null }),
  })

  assert.equal(result, "verified")
  assert.deepEqual(calls, ["finalize:verified"])
})

test("provider success stays authoritative when finalize is stale or unavailable", async () => {
  for (const finalize of [
    async () => false,
    async () => {
      throw new Error("database unavailable")
    },
  ]) {
    const cleanupErrors = []
    const result = await runMerchantOtpProviderVerification({
      finalize,
      onCleanupError: (stage, error) => cleanupErrors.push({ stage, error }),
      release: async () => true,
      verify: async () => ({ error: null }),
    })

    assert.equal(result, "verified")
    assert.equal(cleanupErrors.length, 1)
    assert.equal(cleanupErrors[0].stage, "finalize")
    assert.ok(cleanupErrors[0].error instanceof Error)
  }
})

test("thrown provider/network failures release the lease and stay retryable", async () => {
  const calls = []
  const result = await runMerchantOtpProviderVerification({
    finalize: async (outcome) => {
      calls.push(`finalize:${outcome}`)
      return true
    },
    release: async () => {
      calls.push("release")
      return true
    },
    verify: async () => {
      throw new TypeError("fetch failed")
    },
  })

  assert.equal(result, "retryable")
  assert.deepEqual(calls, ["release"])
})

for (const [label, error] of [
  ["AuthRetryableFetchError", { name: "AuthRetryableFetchError", status: 0 }],
  ["HTTP 408", { status: 408 }],
  ["HTTP 429", { code: "over_request_rate_limit", status: 429 }],
  ["HTTP 503", { code: "unexpected_failure", status: 503 }],
  ["provider timeout", { code: "request_timeout", status: 400 }],
]) {
  test(`${label} releases the lease and stays retryable`, async () => {
    const calls = []
    const result = await runMerchantOtpProviderVerification({
      finalize: async (outcome) => {
        calls.push(`finalize:${outcome}`)
        return true
      },
      release: async () => {
        calls.push("release")
        return true
      },
      verify: async () => ({ error }),
    })

    assert.equal(result, "retryable")
    assert.deepEqual(calls, ["release"])
  })
}

test("otp_expired finalizes expired", async () => {
  const calls = []
  const result = await runMerchantOtpProviderVerification({
    finalize: async (outcome) => {
      calls.push(`finalize:${outcome}`)
      return true
    },
    release: async () => {
      calls.push("release")
      return true
    },
    verify: async () => ({ error: { code: "otp_expired", status: 403 } }),
  })

  assert.equal(result, "expired")
  assert.deepEqual(calls, ["finalize:expired"])
})

test("a definitive invalid token finalizes rejected", async () => {
  const calls = []
  const result = await runMerchantOtpProviderVerification({
    finalize: async (outcome) => {
      calls.push(`finalize:${outcome}`)
      return true
    },
    release: async () => {
      calls.push("release")
      return true
    },
    verify: async () => ({
      error: { code: "invalid_credentials", status: 400 },
    }),
  })

  assert.equal(result, "rejected")
  assert.deepEqual(calls, ["finalize:rejected"])
})

for (const [label, error] of [
  ["AuthUnknownError", { name: "AuthUnknownError" }],
  ["an unknown future provider code", { code: "future_failure", status: 400 }],
  ["an unclassified provider response", { message: "unexpected shape" }],
]) {
  test(`${label} releases the lease instead of consuming it`, async () => {
    const calls = []
    const result = await runMerchantOtpProviderVerification({
      finalize: async (outcome) => {
        calls.push(`finalize:${outcome}`)
        return true
      },
      release: async () => {
        calls.push("release")
        return true
      },
      verify: async () => ({ error }),
    })

    assert.equal(result, "retryable")
    assert.deepEqual(calls, ["release"])
  })
}

test("a release cleanup failure does not reclassify a retryable provider outage", async () => {
  const cleanupErrors = []
  const result = await runMerchantOtpProviderVerification({
    finalize: async () => true,
    onCleanupError: (stage, error) => cleanupErrors.push({ stage, error }),
    release: async () => {
      throw new Error("database unavailable")
    },
    verify: async () => ({ error: { status: 500 } }),
  })

  assert.equal(result, "retryable")
  assert.equal(cleanupErrors.length, 1)
  assert.equal(cleanupErrors[0].stage, "release")
})

test("the pure classifier handles null, thrown, expiry, retryable, and rejection", () => {
  assert.equal(classifyMerchantOtpProviderOutcome(null, false), "verified")
  assert.equal(
    classifyMerchantOtpProviderOutcome(new Error("boom"), true),
    "retryable"
  )
  assert.equal(
    classifyMerchantOtpProviderOutcome(
      { code: "otp_expired", status: 403 },
      false
    ),
    "expired"
  )
  assert.equal(
    classifyMerchantOtpProviderOutcome(
      { name: "AuthRetryableFetchError" },
      false
    ),
    "retryable"
  )
  assert.equal(
    classifyMerchantOtpProviderOutcome(
      { code: "invalid_credentials", status: 400 },
      false
    ),
    "rejected"
  )
})
