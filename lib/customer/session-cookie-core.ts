import { createHmac, timingSafeEqual } from "node:crypto"

import {
  createEncryptedPendingCookieValue,
  readEncryptedPendingCookieValue,
} from "@/lib/customer/pending-cookie-crypto"

export type PendingPhonePurpose = "join" | "wallet"

export type PendingPhonePayload = {
  readonly version: 2
  readonly purpose: PendingPhonePurpose
  readonly phone: string
  readonly phoneHmac: string
  readonly country: string
  readonly issuedAt: number
  readonly expiresAt: number
}

export type CustomerSessionPayload = {
  readonly version: 2
  readonly sessionId: string
  readonly customerId: string
  readonly issuedAt: number
  readonly expiresAt: number
}

export type PendingEmailPayload = {
  readonly version: 1
  readonly email: string
  readonly codeHmac: string
  readonly customerId: string | null
  readonly issuedAt: number
  readonly expiresAt: number
}

export type PendingAccessRecoveryPayload = {
  readonly version: 1
  readonly sessionId: string
  readonly customerId: string
  readonly phoneHmac: string
  readonly deviceHash: string
  readonly emailHmac: string | null
  readonly codeHmac: string | null
  readonly next: string
  readonly issuedAt: number
  readonly expiresAt: number
}

export type CookieReadResult<T> =
  | { readonly ok: true; readonly payload: T }
  | {
      readonly ok: false
      readonly reason: "malformed" | "invalid_signature" | "expired"
    }

export function createPendingPhoneCookieValue(
  payload: PendingPhonePayload,
  secret: string
): string {
  return createEncryptedPendingCookieValue({
    payload,
    secret,
    context: "phone",
  })
}

export function readPendingPhoneCookieValue(
  value: string,
  secret: string,
  nowSeconds: number
): CookieReadResult<PendingPhonePayload> {
  return readEncryptedPendingCookieValue({
    value,
    secret,
    context: "phone",
    nowSeconds,
    parse: parsePendingPhonePayload,
  })
}

export function createPendingEmailCookieValue(
  payload: PendingEmailPayload,
  secret: string
): string {
  return createEncryptedPendingCookieValue({
    payload,
    secret,
    context: "email",
  })
}

export function readPendingEmailCookieValue(
  value: string,
  secret: string,
  nowSeconds: number
): CookieReadResult<PendingEmailPayload> {
  return readEncryptedPendingCookieValue({
    value,
    secret,
    context: "email",
    nowSeconds,
    parse: parsePendingEmailPayload,
  })
}

export function createPendingAccessRecoveryCookieValue(
  payload: PendingAccessRecoveryPayload,
  secret: string
): string {
  return createEncryptedPendingCookieValue({
    payload,
    secret,
    context: "access-recovery",
  })
}

export function readPendingAccessRecoveryCookieValue(
  value: string,
  secret: string,
  nowSeconds: number
): CookieReadResult<PendingAccessRecoveryPayload> {
  return readEncryptedPendingCookieValue({
    value,
    secret,
    context: "access-recovery",
    nowSeconds,
    parse: parsePendingAccessRecoveryPayload,
  })
}

export function createCustomerSessionCookieValue(
  payload: CustomerSessionPayload,
  secret: string
): string {
  return signPayload(payload, secret)
}

export function readCustomerSessionCookieValue(
  value: string,
  secret: string,
  nowSeconds: number
): CookieReadResult<CustomerSessionPayload> {
  return readSignedPayload(
    value,
    secret,
    nowSeconds,
    parseCustomerSessionPayload
  )
}

function signPayload(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  )
  return `${body}.${signature(body, secret)}`
}

function readSignedPayload<T extends { readonly expiresAt: number }>(
  value: string,
  secret: string,
  nowSeconds: number,
  parse: (value: unknown) => T | null
): CookieReadResult<T> {
  const parts = value.split(".")
  if (parts.length !== 2) return { ok: false, reason: "malformed" }

  const [body, receivedSignature] = parts
  if (!body || !receivedSignature) return { ok: false, reason: "malformed" }
  if (!signaturesMatch(signature(body, secret), receivedSignature)) {
    return { ok: false, reason: "invalid_signature" }
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  } catch {
    return { ok: false, reason: "malformed" }
  }

  const payload = parse(decoded)
  if (!payload) return { ok: false, reason: "malformed" }
  if (payload.expiresAt <= nowSeconds) return { ok: false, reason: "expired" }

  return { ok: true, payload }
}

function signature(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url")
}

function signaturesMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected, "base64url")
  const receivedBuffer = Buffer.from(received, "base64url")

  return (
    expectedBuffer.byteLength === receivedBuffer.byteLength &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  )
}

function parsePendingPhonePayload(value: unknown): PendingPhonePayload | null {
  if (!isRecord(value)) return null

  const version = value.version
  const purpose = value.purpose
  const phone = value.phone
  const phoneHmac = value.phoneHmac
  const country = value.country
  const issuedAt = value.issuedAt
  const expiresAt = value.expiresAt

  if (version !== 2) return null
  if (purpose !== "join" && purpose !== "wallet") return null
  if (typeof phone !== "string") return null
  if (typeof phoneHmac !== "string") return null
  if (typeof country !== "string") return null
  if (typeof issuedAt !== "number") return null
  if (typeof expiresAt !== "number") return null

  return {
    version,
    purpose,
    phone,
    phoneHmac,
    country,
    issuedAt,
    expiresAt,
  }
}

function parsePendingEmailPayload(value: unknown): PendingEmailPayload | null {
  if (!isRecord(value)) return null

  const version = value.version
  const email = value.email
  const codeHmac = value.codeHmac
  const customerId = value.customerId ?? null
  const issuedAt = value.issuedAt
  const expiresAt = value.expiresAt

  if (version !== 1) return null
  if (typeof email !== "string") return null
  if (typeof codeHmac !== "string") return null
  if (customerId !== null && typeof customerId !== "string") return null
  if (typeof issuedAt !== "number") return null
  if (typeof expiresAt !== "number") return null

  return { version, email, codeHmac, customerId, issuedAt, expiresAt }
}

function parsePendingAccessRecoveryPayload(
  value: unknown
): PendingAccessRecoveryPayload | null {
  if (!isRecord(value)) return null

  const version = value.version
  const sessionId = value.sessionId
  const customerId = value.customerId
  const phoneHmac = value.phoneHmac
  const deviceHash = value.deviceHash
  const emailHmac = value.emailHmac ?? null
  const codeHmac = value.codeHmac ?? null
  const next = value.next
  const issuedAt = value.issuedAt
  const expiresAt = value.expiresAt

  if (version !== 1) return null
  if (typeof sessionId !== "string") return null
  if (typeof customerId !== "string") return null
  if (typeof phoneHmac !== "string") return null
  if (typeof deviceHash !== "string") return null
  if (emailHmac !== null && typeof emailHmac !== "string") return null
  if (codeHmac !== null && typeof codeHmac !== "string") return null
  if (
    typeof next !== "string" ||
    !next.startsWith("/") ||
    next.startsWith("//")
  ) {
    return null
  }
  if (typeof issuedAt !== "number") return null
  if (typeof expiresAt !== "number") return null

  return {
    version,
    sessionId,
    customerId,
    phoneHmac,
    deviceHash,
    emailHmac,
    codeHmac,
    next,
    issuedAt,
    expiresAt,
  }
}

function parseCustomerSessionPayload(
  value: unknown
): CustomerSessionPayload | null {
  if (!isRecord(value)) return null

  const version = value.version
  const sessionId = value.sessionId
  const customerId = value.customerId
  const issuedAt = value.issuedAt
  const expiresAt = value.expiresAt

  if (version !== 2) return null
  if (typeof sessionId !== "string") return null
  if (typeof customerId !== "string") return null
  if (typeof issuedAt !== "number") return null
  if (typeof expiresAt !== "number") return null

  return { version, sessionId, customerId, issuedAt, expiresAt }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
