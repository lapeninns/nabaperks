import { verifyEnvelopeSignature } from "./proof-envelope.mjs"

const SHA = /^[a-f0-9]{40}$/
const DIGEST = /^[a-f0-9]{64}$/
const BINDINGS = [
  "repository",
  "appId",
  "sha",
  "profile",
  "commandDigest",
  "imageDigest",
  "runtimeSha",
  "attemptId",
  "challenge",
]
const PAYLOAD_KEYS = [
  "version",
  ...BINDINGS,
  "startedAt",
  "completedAt",
  "lanes",
]
const LANE_KEYS = ["name", "outcome", "logDigest"]
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value)
const exactKeys = (value, keys) =>
  record(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key))
const nonempty = (value) => typeof value === "string" && value.length > 0

/** Policy must come from protected supervisor state, NEVER the candidate checkout.
 * appId is also checked against API publisher metadata by the trusted adapter.
 * observedLogDigests are hashes computed from supervisor-collected raw logs.
 */
export function verifyProofPolicy({
  envelope,
  policy,
  now,
  observedLogDigests,
  publisherAppId,
}) {
  const failures = []
  if (!validPolicy(policy) || !Number.isSafeInteger(now))
    return { valid: false, failures: ["invalid-trusted-policy"] }
  if (
    !exactKeys(envelope, ["payload", "signature"]) ||
    !exactKeys(envelope.payload, PAYLOAD_KEYS)
  ) {
    return { valid: false, failures: ["malformed-envelope"] }
  }
  const payload = envelope.payload
  if (payload.version !== 1) failures.push("unsupported-version")
  for (const key of BINDINGS)
    if (payload[key] !== policy[key]) failures.push(`mismatch:${key}`)
  if (publisherAppId !== policy.appId) failures.push("publisher-mismatch")
  if (!verifyEnvelopeSignature(envelope, policy.publicKey))
    failures.push("invalid-signature")
  if (
    !Number.isSafeInteger(payload.startedAt) ||
    !Number.isSafeInteger(payload.completedAt) ||
    payload.startedAt < policy.requestedAt ||
    payload.completedAt < payload.startedAt ||
    payload.completedAt > now ||
    payload.startedAt > now ||
    now - payload.completedAt > policy.maxAgeMs ||
    payload.completedAt - payload.startedAt > policy.maxDurationMs
  )
    failures.push("invalid-time-window")
  if (!Array.isArray(payload.lanes)) failures.push("invalid-lanes")
  else validateLanes(payload.lanes, policy.lanes, observedLogDigests, failures)
  return { valid: failures.length === 0, failures }
}

function validPolicy(policy) {
  return (
    record(policy) &&
    nonempty(policy.repository) &&
    Number.isSafeInteger(policy.appId) &&
    policy.appId > 0 &&
    SHA.test(policy.sha) &&
    SHA.test(policy.runtimeSha) &&
    DIGEST.test(policy.commandDigest) &&
    /^sha256:[a-f0-9]{64}$/.test(policy.imageDigest) &&
    nonempty(policy.profile) &&
    nonempty(policy.attemptId) &&
    /^[a-f0-9]{64}$/.test(policy.challenge) &&
    Boolean(policy.publicKey) &&
    Number.isSafeInteger(policy.requestedAt) &&
    Number.isSafeInteger(policy.maxAgeMs) &&
    policy.maxAgeMs > 0 &&
    Number.isSafeInteger(policy.maxDurationMs) &&
    policy.maxDurationMs > 0 &&
    Array.isArray(policy.lanes) &&
    policy.lanes.length > 0 &&
    policy.lanes.every(nonempty) &&
    new Set(policy.lanes).size === policy.lanes.length
  )
}

function validateLanes(lanes, expected, logs, failures) {
  if (!exactKeys(logs, expected)) failures.push("invalid-log-inventory")
  const names = lanes.map((lane) => lane?.name)
  if (
    lanes.length !== expected.length ||
    new Set(names).size !== names.length ||
    expected.some((name) => !names.includes(name))
  )
    failures.push("lane-inventory-mismatch")
  for (const lane of lanes) {
    if (!exactKeys(lane, LANE_KEYS)) {
      failures.push("malformed-lane")
      continue
    }
    if (lane.outcome !== "success")
      failures.push(`lane-not-successful:${lane.name}`)
    if (!DIGEST.test(lane.logDigest) || lane.logDigest !== logs?.[lane.name])
      failures.push(`log-mismatch:${lane.name}`)
  }
}
