import assert from "node:assert/strict"
import { test } from "node:test"

import {
  DESCRIBE_VALUE_MAX_LENGTH,
  describeValue,
  toEpochMs,
  validateContract,
} from "../../ops/local-ci/core/contract.mjs"
import { nightlyProofMaxAgeHours } from "../../scripts/check-nightly-proof.mjs"

/**
 * local CI — what a refusal is allowed to say about the value it refused.
 *
 * `describeValue` is interpolated into every refusal raised under
 * ops/local-ci, and those refusals reach logs, GitHub step summaries and
 * published check runs. So the description is an output boundary, not a
 * debugging convenience: it may report a value's type and shape, and nothing
 * that could carry the value's contents. Two things follow, and both are
 * asserted here — a function is never stringified, because `String(fn)` is its
 * entire source, and an object is never stringified, because job-env.mjs
 * builds the host-secret isolation boundary on top of this module.
 */

// Written as a literal inside the function body below, so the assertions are
// checking the function's *source text*, not a variable it happens to close
// over.
const CANARY = "describe-value-canary-8f21"

function loadProfile(name) {
  return `describe-value-canary-8f21:${name}`
}

test("a function is described by name and arity, never by its source", () => {
  assert.equal(describeValue(loadProfile), "function loadProfile/1")

  const described = describeValue(loadProfile)
  assert.ok(!described.includes(CANARY))
  assert.ok(!described.includes("return"))
  assert.ok(!described.includes("{"))
})

test("an anonymous function is named as such rather than pasted in", () => {
  assert.equal(
    describeValue(function () {}),
    "function (anonymous)/0"
  )
  assert.equal(
    describeValue((a, b) => a + b),
    "function (anonymous)/2"
  )
})

test("no call site can leak a callback's source into a refusal", () => {
  // Every refusal that names a rejected function argument routes through
  // describeValue, so proving the helper is bounded proves the call sites are.
  assert.throws(
    () => toEpochMs(loadProfile, "startedAt"),
    (error) => {
      assert.equal(error.code, "INVALID_TIMESTAMP")
      assert.ok(error.message.includes("function loadProfile/1"))
      assert.ok(!error.message.includes(CANARY))
      return true
    }
  )

  assert.throws(
    () => validateContract(loadProfile),
    (error) => {
      assert.equal(error.code, "CONTRACT_SHAPE")
      assert.ok(!error.message.includes(CANARY))
      return true
    }
  )
})

test("the nightly monitor shares the hardened helper, not a stale copy", () => {
  assert.throws(
    () =>
      nightlyProofMaxAgeHours({ nightlyProof: { maxAgeHours: loadProfile } }),
    (error) => {
      assert.equal(error.code, "INVALID_CONTRACT")
      assert.ok(error.message.includes("function loadProfile/1"))
      assert.ok(!error.message.includes(CANARY))
      return true
    }
  )
})

test("an object is described by key count, never by its contents", () => {
  assert.equal(describeValue({}), "an object with 0 keys")
  assert.equal(describeValue({ a: 1 }), "an object with 1 key")

  const env = { SERVICE_ROLE_KEY: CANARY, GITHUB_APP_PRIVATE_KEY: CANARY }
  assert.equal(describeValue(env), "an object with 2 keys")
  assert.ok(!describeValue(env).includes(CANARY))

  // A caller-supplied toString is exactly what the old String(value) would
  // have run; the description must not give it a voice.
  assert.equal(
    describeValue({ toString: () => CANARY }),
    "an object with 1 key"
  )
})

test("describing a value never throws, even when reading it does", () => {
  // A revoked Proxy throws from every reflective operation, including the
  // Array.isArray probe, so even the type is unknowable here.
  const { proxy, revoke } = Proxy.revocable({ a: 1 }, {})
  revoke()
  assert.equal(describeValue(proxy), "a value that cannot be described")

  const named = function () {}
  Object.defineProperty(named, "name", {
    get() {
      throw new Error("name is not readable")
    },
  })
  assert.equal(describeValue(named), "function (unreadable)")
})

test("a pathological value cannot flood a log through a refusal", () => {
  const wide = describeValue("x".repeat(5000))
  assert.ok(wide.length < DESCRIBE_VALUE_MAX_LENGTH + 40)
  assert.ok(wide.startsWith('the string "xxx'))
  assert.ok(wide.includes("characters"))

  const renamed = function () {}
  Object.defineProperty(renamed, "name", { value: "n".repeat(5000) })
  assert.ok(describeValue(renamed).length < DESCRIBE_VALUE_MAX_LENGTH + 40)
})

test("the branches other modules already depend on are unchanged", () => {
  assert.equal(describeValue(null), "null")
  assert.equal(describeValue([1, 2, 3]), "an array of length 3")
  assert.equal(describeValue([]), "an array of length 0")
  assert.equal(describeValue("main"), 'the string "main"')
  assert.equal(describeValue(42), "number 42")
  assert.equal(describeValue(true), "boolean true")
  assert.equal(describeValue(undefined), "undefined undefined")
  assert.equal(describeValue(Symbol("lane")), "symbol Symbol(lane)")
})
