const ALERT_SCHEMA = "nabaperks.production-alert.v1"
const MAX_BODY_BYTES = 8_192
const MAX_CLOCK_SKEW_SECONDS = 300
const EXPECTED_KEYS = [
  "action",
  "dedupKey",
  "deliveryId",
  "environment",
  "kind",
  "occurredAt",
  "revision",
  "runUrl",
  "schema",
  "service",
  "severity",
  "summary",
]
const ALERT_KINDS = {
  readiness: {
    dedupKey: "nabaperks-production-readiness",
    summary: "Nabaperks production liveness or readiness probe failed",
  },
  "availability-slo": {
    dedupKey: "nabaperks-production-availability-slo",
    summary: "Nabaperks production availability SLO is breached",
  },
  "release-canary": {
    dedupKey: "nabaperks-production-release-canary",
    summary: "Nabaperks production alert receiver release canary",
  },
}

export class ProductionAlertError extends Error {
  constructor(status, code) {
    super(code)
    this.name = "ProductionAlertError"
    this.status = status
    this.code = code
  }
}

export function assertProductionAlertEnvelope({
  method,
  contentType,
  contentLength,
}) {
  if (method !== "POST") reject(405, "method_not_allowed")
  if (
    contentType?.split(";", 1)[0].trim().toLowerCase() !== "application/json"
  ) {
    reject(400, "invalid_content_type")
  }
  if (
    !/^\d+$/.test(contentLength ?? "") ||
    Number(contentLength) > MAX_BODY_BYTES
  ) {
    reject(400, "invalid_body_size")
  }
}

function reject(status, code) {
  throw new ProductionAlertError(status, code)
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }
  return difference === 0
}

function decodeHex(value) {
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

async function expectedSignature(secret, timestamp, bodyBytes) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  )
  const prefix = new TextEncoder().encode(`${timestamp}.`)
  const signedBytes = new Uint8Array(prefix.length + bodyBytes.length)
  signedBytes.set(prefix)
  signedBytes.set(bodyBytes, prefix.length)
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, signedBytes))
}

function validatePayload(payload, deliveryHeader, signedTimestamp) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    reject(400, "invalid_payload")
  }
  const keys = Object.keys(payload).sort()
  if (
    keys.length !== EXPECTED_KEYS.length ||
    keys.some((key, index) => key !== EXPECTED_KEYS[index])
  ) {
    reject(400, "invalid_payload_shape")
  }

  const kindConfig = ALERT_KINDS[payload.kind]
  if (
    payload.schema !== ALERT_SCHEMA ||
    !kindConfig ||
    !["trigger", "resolve"].includes(payload.action) ||
    payload.dedupKey !== kindConfig.dedupKey ||
    payload.summary !== kindConfig.summary ||
    payload.severity !== "critical" ||
    payload.service !== "nabaperks" ||
    payload.environment !== "production"
  ) {
    reject(400, "invalid_payload_values")
  }
  if (
    typeof payload.deliveryId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      payload.deliveryId
    ) ||
    payload.deliveryId !== deliveryHeader
  ) {
    reject(400, "invalid_delivery")
  }
  if (
    payload.revision !== null &&
    (typeof payload.revision !== "string" ||
      !/^[0-9a-f]{12}$/.test(payload.revision))
  ) {
    reject(400, "invalid_revision")
  }
  if (
    typeof payload.runUrl !== "string" ||
    !/^https:\/\/github\.com\/lapeninns\/nabaperks\/actions\/runs\/\d+$/.test(
      payload.runUrl
    )
  ) {
    reject(400, "invalid_run_url")
  }

  const occurredAtMilliseconds = Date.parse(payload.occurredAt)
  if (
    typeof payload.occurredAt !== "string" ||
    !Number.isFinite(occurredAtMilliseconds) ||
    Math.abs(Math.floor(occurredAtMilliseconds / 1_000) - signedTimestamp) > 1
  ) {
    reject(400, "invalid_occurred_at")
  }
  return payload
}

export async function verifyProductionAlert({
  method,
  contentType,
  contentLength,
  signature,
  timestamp,
  delivery,
  bodyBytes,
  secret,
  nowMilliseconds = Date.now(),
}) {
  assertProductionAlertEnvelope({ method, contentType, contentLength })
  if (
    !(bodyBytes instanceof Uint8Array) ||
    bodyBytes.length === 0 ||
    bodyBytes.length > MAX_BODY_BYTES ||
    Number(contentLength) !== bodyBytes.length
  ) {
    reject(400, "invalid_body_size")
  }
  if (typeof secret !== "string" || secret.length < 32 || secret.length > 512) {
    reject(503, "receiver_not_configured")
  }
  if (!/^\d{10}$/.test(timestamp ?? "")) reject(401, "invalid_signature")
  const signedTimestamp = Number(timestamp)
  if (
    Math.abs(Math.floor(nowMilliseconds / 1_000) - signedTimestamp) >
    MAX_CLOCK_SKEW_SECONDS
  ) {
    reject(401, "expired_signature")
  }
  if (!/^v1=[0-9a-f]{64}$/.test(signature ?? "")) {
    reject(401, "invalid_signature")
  }

  const expected = await expectedSignature(secret, timestamp, bodyBytes)
  const supplied = decodeHex(signature.slice(3))
  if (!constantTimeEqual(expected, supplied)) reject(401, "invalid_signature")

  let payload
  try {
    payload = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes)
    )
  } catch {
    reject(400, "invalid_json")
  }
  return validatePayload(payload, delivery, signedTimestamp)
}

export async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function deliverVerifiedProductionAlert({
  payload,
  payloadHash,
  claimDelivery,
  sendPage,
  completeDelivery,
}) {
  let claim
  try {
    claim = await claimDelivery({ payload, payloadHash })
  } catch {
    reject(503, "claim_failed")
  }
  if (!claim || typeof claim.pageRequired !== "boolean") {
    reject(503, "claim_failed")
  }
  if (!claim.pageRequired) {
    return { accepted: true, duplicate: claim.duplicate === true }
  }

  try {
    await sendPage(payload, claim.recipientEmail)
  } catch {
    reject(503, "paging_failed")
  }
  try {
    await completeDelivery(payload.deliveryId)
  } catch {
    reject(503, "receipt_failed")
  }
  return { accepted: true, duplicate: false }
}

export function buildProductionAlertEmail(payload) {
  const state = payload.action === "trigger" ? "triggered" : "resolved"
  const subject = `[Production alert] Nabaperks ${payload.kind} ${state}`
  const revision = payload.revision ?? "not supplied"
  const text = [
    `The Nabaperks production ${payload.kind} alert has ${state}.`,
    `Revision: ${revision}`,
    `Occurred at: ${payload.occurredAt}`,
    `GitHub Actions run: ${payload.runUrl}`,
  ].join("\n")
  return { subject, text }
}
