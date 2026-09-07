import assert from "node:assert/strict"
import { generateKeyPairSync } from "node:crypto"
import { test } from "node:test"
import { signProofEnvelope } from "../../ops/local-ci/core/proof-envelope.mjs"
import { verifyProofPolicy } from "../../ops/local-ci/core/proof-policy.mjs"
import {
  FULL_HOSTED_ROOTS,
  routeTrustedProof,
} from "../../ops/local-ci/core/routing.mjs"

const { privateKey, publicKey } = generateKeyPairSync("ed25519")
function fixture() {
  const policy = {
    repository: "lapeninns/nabaperks",
    appId: 123,
    sha: "a".repeat(40),
    profile: "main",
    commandDigest: "b".repeat(64),
    imageDigest: `sha256:${"c".repeat(64)}`,
    runtimeSha: "d".repeat(40),
    attemptId: "main-2",
    challenge: "e".repeat(64),
    requestedAt: 1000,
    maxAgeMs: 1000,
    maxDurationMs: 1000,
    publicKey,
    lanes: [...FULL_HOSTED_ROOTS],
  }
  const {
    requestedAt,
    maxAgeMs,
    maxDurationMs,
    publicKey: ignoredKey,
    lanes,
    ...bindings
  } = policy
  void requestedAt
  void maxAgeMs
  void maxDurationMs
  void ignoredKey
  const payload = {
    version: 1,
    ...bindings,
    startedAt: 1100,
    completedAt: 1200,
    lanes: lanes.map((name) => ({
      name,
      outcome: "success",
      logDigest: "f".repeat(64),
    })),
  }
  return {
    envelope: signProofEnvelope(payload, privateKey),
    policy,
    now: 1500,
    publisherAppId: 123,
    observedLogDigests: Object.fromEntries(
      lanes.map((name) => [name, "f".repeat(64)])
    ),
  }
}
function changePayload(input, mutate) {
  mutate(input.envelope.payload)
  input.envelope = signProofEnvelope(input.envelope.payload, privateKey)
}

test("signed proof binds independently supplied policy, publisher and observed logs", () => {
  assert.equal(verifyProofPolicy(fixture()).valid, true)
})
for (const key of [
  "repository",
  "appId",
  "sha",
  "profile",
  "commandDigest",
  "imageDigest",
  "runtimeSha",
  "attemptId",
  "challenge",
]) {
  test(`rejects signed mismatched ${key}`, () => {
    const input = fixture()
    changePayload(input, (payload) => {
      payload[key] = "other"
    })
    assert.equal(verifyProofPolicy(input).valid, false)
  })
}
for (const [name, mutate] of Object.entries({
  missing: (p) => {
    p.lanes.pop()
  },
  extra: (p) => {
    p.lanes.push({ ...p.lanes[0], name: "extra" })
  },
  duplicate: (p) => {
    p.lanes[1] = p.lanes[0]
  },
  failure: (p) => {
    p.lanes[0].outcome = "failure"
  },
  skipped: (p) => {
    p.lanes[0].outcome = "skipped"
  },
  malformed: (p) => {
    p.lanes[0].extra = true
  },
  future: (p) => {
    p.completedAt = 2000
  },
  reversed: (p) => {
    p.startedAt = 1300
  },
  predatesRequest: (p) => {
    p.startedAt = 900
  },
  badTime: (p) => {
    p.startedAt = "1100"
  },
  logTampering: (p) => {
    p.lanes[0].logDigest = "0".repeat(64)
  },
  unknownField: (p) => {
    p.extra = true
  },
})) {
  test(`rejects ${name} evidence even with valid signature`, () => {
    const input = fixture()
    changePayload(input, mutate)
    assert.equal(verifyProofPolicy(input).valid, false)
  })
}
test("rejects stale, forged, wrong publisher, missing logs and invalid policy", () => {
  for (const mutate of [
    (i) => {
      i.now = 3000
    },
    (i) => {
      i.envelope.payload.sha = "0".repeat(40)
    },
    (i) => {
      i.publisherAppId = 456
    },
    (i) => {
      delete i.observedLogDigests.db
    },
    (i) => {
      i.policy = null
    },
    (i) => {
      i.policy.publicKey = generateKeyPairSync("ed25519").publicKey
    },
  ]) {
    const input = fixture()
    mutate(input)
    assert.equal(verifyProofPolicy(input).valid, false)
  }
})

test("routing defaults to complete hosted coverage, never local authority", async () => {
  assert.deepEqual((await routeTrustedProof()).requiredRoots, FULL_HOSTED_ROOTS)
  assert.equal((await routeTrustedProof()).route, "hosted")
})
test("routing consumes trusted attempt once and rejects replay/concurrent duplicates", async () => {
  let consumed = false
  const input = {
    ...fixture(),
    authorityEnabled: true,
    available: true,
    paused: false,
    qualified: true,
    consumeAttempt: async () => {
      if (consumed) return false
      consumed = true
      return true
    },
  }
  const results = await Promise.all([
    routeTrustedProof(input),
    routeTrustedProof(input),
  ])
  assert.deepEqual(results.map((r) => r.route).sort(), ["hosted", "local"])
})
test("offline, paused, unqualified, superseded, partial and unavailable verification fall back fully", async () => {
  const overrides = [
    { available: false },
    { paused: true },
    { qualified: false },
    { consumeAttempt: async () => false },
    { consumeAttempt: undefined },
    {
      consumeAttempt: async () => {
        throw Error("ledger unavailable")
      },
    },
    { envelope: null },
    { policy: { ...fixture().policy, lanes: ["fast"] } },
  ]
  for (const override of overrides) {
    const result = await routeTrustedProof({
      ...fixture(),
      authorityEnabled: true,
      available: true,
      paused: false,
      qualified: true,
      consumeAttempt: async () => true,
      ...override,
    })
    assert.equal(result.route, "hosted")
    assert.deepEqual(result.requiredRoots, FULL_HOSTED_ROOTS)
  }
})

test("trusted read-only observer authenticates metadata once and never grants authority", async () => {
  const { observeTrustedLocalProof } =
    await import("../../scripts/ci/observe-trusted-local-proof.mjs")
  const input = fixture()
  let calls = 0
  const options = {
    ...input,
    repository: input.policy.repository,
    sha: input.policy.sha,
    token: "fixture",
    policy: { ...input.policy, checkName: "Local CI" },
    fetchImpl: async () => {
      calls += 1
      return {
        ok: true,
        json: async () => ({
          total_count: 1,
          check_runs: [
            {
              name: "Local CI",
              head_sha: input.policy.sha,
              app: { id: 123 },
              status: "completed",
              conclusion: "success",
              output: { text: JSON.stringify(input.envelope) },
            },
          ],
        }),
      }
    },
  }
  const result = await observeTrustedLocalProof(options)
  assert.equal(calls, 1)
  assert.equal(result.proofValid, true)
  assert.equal(result.route, "hosted")
  assert.deepEqual(result.requiredRoots, FULL_HOSTED_ROOTS)
  assert.equal(
    (await observeTrustedLocalProof({ ...options, policy: null })).proofValid,
    false
  )
  assert.equal(calls, 1)
  assert.equal(
    (
      await observeTrustedLocalProof({
        ...options,
        policy: { ...options.policy, appId: 999 },
      })
    ).proofValid,
    false
  )
})
