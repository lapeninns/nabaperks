import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto"

import { normalizeEmail } from "@/lib/customer/email-pii-core"
import {
  createEncryptedPendingCookieValue,
  readEncryptedPendingCookieValue,
  type EncryptedPendingCookieReadResult,
} from "@/lib/customer/pending-cookie-crypto"

/**
 * Pure codec for signed-out email sign-in: the code digest, the encrypted
 * pending-challenge cookie and the verified-email handoff cookie.
 *
 * No `server-only`, no request APIs and no Supabase, so the binding rules
 * unit-test directly and end-to-end fixtures can derive the real digest in
 * plain Node (as `access-continuity-core.ts` allows for recovery codes). The
 * secret is always passed in for the same reason.
 */

export type EmailSignInPurpose = "join" | "wallet"

export const PENDING_EMAIL_SIGN_IN_COOKIE_NAME =
  "nabaperks_pending_email_sign_in"
export const VERIFIED_EMAIL_HANDOFF_COOKIE_NAME = "nabaperks_email_handoff"

export const EMAIL_SIGN_IN_VERSION = 1
/** A code is good for ten minutes. */
export const EMAIL_SIGN_IN_TTL_SECONDS = 10 * 60
/** Matches the shared 60-second recipient cooldown in the admission RPC. */
export const EMAIL_SIGN_IN_RESEND_AFTER_SECONDS = 60
/** The verified-email handoff lasts as long as a code would. */
export const EMAIL_HANDOFF_TTL_SECONDS = 10 * 60

/**
 * What happened to a challenge's code. Every value is four characters, so the
 * encrypted cookie is the same length whichever one it holds and a refused
 * send cannot be told apart from an admitted one by its Set-Cookie.
 *
 * - `sent`: the code was handed to the provider (or the local dev code stands
 *   in for it).
 * - `held`: admission refused, so no code exists. The digest is random bytes
 *   derived from no code, and a check refuses it before comparing anything.
 * - `fail`: the provider errored. The code still works if the email arrives
 *   late, but the challenge is never reported as a code on its way.
 */
export type EmailSignInDelivery = "sent" | "held" | "fail"

/** All times are epoch seconds, as the pending-cookie reader compares them. */
export type PendingEmailSignInPayload = {
  readonly version: 1
  readonly purpose: EmailSignInPurpose
  readonly email: string
  readonly emailHmac: string
  readonly challengeId: string
  readonly codeHmac: string
  readonly delivery: EmailSignInDelivery
  readonly issuedAt: number
  readonly expiresAt: number
  readonly resendAvailableAt: number
}

/**
 * Proof that this device verified `email` moments ago while no wallet held it.
 * It creates nothing by itself: it only lets the choice screen offer a new
 * wallet for the same device, venue and QR it was issued for.
 */
export type VerifiedEmailHandoffPayload = {
  readonly version: 1
  /** Spent server-side on first use, so a copied cookie cannot be replayed. */
  readonly handoffId: string
  readonly email: string
  readonly emailHmac: string
  readonly deviceHash: string
  readonly merchantSlug: string
  readonly qrId: string | null
  readonly issuedAt: number
  readonly expiresAt: number
}

export type VerifiedEmailHandoffBinding = {
  readonly deviceHash: string | null
  readonly merchantSlug: string
  readonly qrId: string | null | undefined
}

const SIX_DIGITS = /^\d{6}$/
const HEX_DIGEST = /^[0-9a-f]{64}$/

/**
 * D7: the digest binds the code to its purpose, its challenge and its address,
 * under a versioned domain, so a code minted for one of those can never pass
 * as another. Fields are separated by NUL, which none of them can contain.
 * The address is normalised as stored addresses are (trim, lower case, NFC),
 * which for ASCII is the plain trim and lower case of earlier challenges.
 */
export function emailSignInCodeHmac({
  secret,
  purpose,
  challengeId,
  email,
  code,
  version = EMAIL_SIGN_IN_VERSION,
}: {
  secret: string
  purpose: EmailSignInPurpose
  challengeId: string
  email: string
  code: string
  version?: number
}): string {
  return createHmac("sha256", secret)
    .update(`nabaperks:customer-email-sign-in:v${version}`)
    .update("\0")
    .update(purpose)
    .update("\0")
    .update(challengeId)
    .update("\0")
    .update(normalizeEmail(email))
    .update("\0")
    .update(code)
    .digest("hex")
}

export function generateEmailSignInCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

/**
 * The digest a refused (`held`) challenge carries: random bytes of the same
 * shape as a real digest, derived from no code, so no code can match it.
 */
export function unguessableEmailSignInDigest(): string {
  return randomBytes(32).toString("hex")
}

export function isEmailSignInCodeShape(code: string): boolean {
  return SIX_DIGITS.test(code)
}

/** Constant-time comparison of two hex digests of equal length. */
export function emailSignInDigestsMatch(
  actualHex: string,
  expectedHex: string
): boolean {
  if (!HEX_DIGEST.test(actualHex) || !HEX_DIGEST.test(expectedHex)) {
    return false
  }
  return timingSafeEqual(
    Buffer.from(actualHex, "hex"),
    Buffer.from(expectedHex, "hex")
  )
}

export function createPendingEmailSignInCookieValue(
  payload: PendingEmailSignInPayload,
  secret: string
): string {
  return createEncryptedPendingCookieValue({
    payload,
    secret,
    context: "email-sign-in",
  })
}

export function readPendingEmailSignInCookieValue(
  value: string,
  secret: string,
  nowSeconds: number
): EncryptedPendingCookieReadResult<PendingEmailSignInPayload> {
  return readEncryptedPendingCookieValue({
    value,
    secret,
    context: "email-sign-in",
    nowSeconds,
    parse: parsePendingEmailSignInPayload,
  })
}

export function createVerifiedEmailHandoffCookieValue(
  payload: VerifiedEmailHandoffPayload,
  secret: string
): string {
  return createEncryptedPendingCookieValue({
    payload,
    secret,
    context: "email-handoff",
  })
}

export function readVerifiedEmailHandoffCookieValue(
  value: string,
  secret: string,
  nowSeconds: number
): EncryptedPendingCookieReadResult<VerifiedEmailHandoffPayload> {
  return readEncryptedPendingCookieValue({
    value,
    secret,
    context: "email-handoff",
    nowSeconds,
    parse: parseVerifiedEmailHandoffPayload,
  })
}

/**
 * The handoff only counts on the device, venue and QR it was issued for. Each
 * field is compared in constant time over a fixed-length digest.
 */
export function verifiedEmailHandoffMatches(
  payload: VerifiedEmailHandoffPayload,
  binding: VerifiedEmailHandoffBinding
): boolean {
  if (!binding.deviceHash) return false
  const device = sameText(payload.deviceHash, binding.deviceHash)
  const merchant = sameText(payload.merchantSlug, binding.merchantSlug)
  const qr = sameText(payload.qrId ?? "", binding.qrId || "")
  return device && merchant && qr
}

export function parsePendingEmailSignInPayload(
  value: unknown
): PendingEmailSignInPayload | null {
  if (!isRecord(value)) return null
  const {
    version,
    purpose,
    email,
    emailHmac,
    challengeId,
    codeHmac,
    delivery,
    issuedAt,
    expiresAt,
    resendAvailableAt,
  } = value

  if (version !== 1) return null
  if (purpose !== "join" && purpose !== "wallet") return null
  if (!isNonEmptyString(email) || !isNonEmptyString(challengeId)) return null
  if (!isHexDigest(emailHmac) || !isHexDigest(codeHmac)) return null
  if (!isDelivery(delivery)) return null
  if (!isEpochSeconds(issuedAt) || !isEpochSeconds(expiresAt)) return null
  if (!isEpochSeconds(resendAvailableAt)) return null

  return {
    version,
    purpose,
    email,
    emailHmac,
    challengeId,
    codeHmac,
    delivery,
    issuedAt,
    expiresAt,
    resendAvailableAt,
  }
}

export function parseVerifiedEmailHandoffPayload(
  value: unknown
): VerifiedEmailHandoffPayload | null {
  if (!isRecord(value)) return null
  const {
    version,
    handoffId,
    email,
    emailHmac,
    deviceHash,
    merchantSlug,
    qrId,
    issuedAt,
    expiresAt,
  } = value

  if (version !== 1) return null
  if (!isNonEmptyString(handoffId)) return null
  if (!isNonEmptyString(email) || !isNonEmptyString(merchantSlug)) return null
  if (!isHexDigest(emailHmac) || !isHexDigest(deviceHash)) return null
  if (qrId !== null && !isNonEmptyString(qrId)) return null
  if (!isEpochSeconds(issuedAt) || !isEpochSeconds(expiresAt)) return null

  return {
    version,
    handoffId,
    email,
    emailHmac,
    deviceHash,
    merchantSlug,
    qrId,
    issuedAt,
    expiresAt,
  }
}

/**
 * Which signed-out join challenge a visitor is in when more than one cookie is
 * live: the most recently issued wins. Starting a challenge clears the others,
 * so this only matters for cookies left from an older flow (Back, another
 * tab); the screen then follows what the visitor did last.
 */
export type SignedOutJoinChallenge =
  "email_handoff" | "email_code" | "phone_code"

export function newestSignedOutJoinChallenge(issued: {
  readonly emailHandoff?: number | null
  readonly emailCode?: number | null
  readonly phoneCode?: number | null
}): SignedOutJoinChallenge | null {
  const candidates: [SignedOutJoinChallenge, number | null | undefined][] = [
    // Listed in the order a tie resolves to.
    ["email_handoff", issued.emailHandoff],
    ["email_code", issued.emailCode],
    ["phone_code", issued.phoneCode],
  ]
  let newest: SignedOutJoinChallenge | null = null
  let newestAt = Number.NEGATIVE_INFINITY
  for (const [kind, at] of candidates) {
    if (typeof at === "number" && at > newestAt) {
      newest = kind
      newestAt = at
    }
  }
  return newest
}

function isDelivery(value: unknown): value is EmailSignInDelivery {
  return value === "sent" || value === "held" || value === "fail"
}

function sameText(left: string, right: string): boolean {
  return timingSafeEqual(digest(left), digest(right))
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function isHexDigest(value: unknown): value is string {
  return typeof value === "string" && HEX_DIGEST.test(value)
}

function isEpochSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value)
}
