import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto"

export type PendingCookieContext = "email" | "phone"

type ExpiringPayload = {
  readonly expiresAt: number
}

type EncryptedPendingCookieInput = {
  readonly payload: object
  readonly secret: string
  readonly context: PendingCookieContext
}

type ReadEncryptedPendingCookieInput<T extends ExpiringPayload> = {
  readonly value: string
  readonly secret: string
  readonly context: PendingCookieContext
  readonly nowSeconds: number
  readonly parse: (value: unknown) => T | null
}

export type EncryptedPendingCookieReadResult<T> =
  | { readonly ok: true; readonly payload: T }
  | {
      readonly ok: false
      readonly reason: "malformed" | "invalid_signature" | "expired"
    }

const FORMAT_VERSION = "v2"
const IV_BYTES = 12
const TAG_BYTES = 16
const BASE64URL = /^[A-Za-z0-9_-]+$/

export function createEncryptedPendingCookieValue({
  payload,
  secret,
  context,
}: EncryptedPendingCookieInput): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret, context), iv)
  cipher.setAAD(authenticatedContext(context))
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    FORMAT_VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".")
}

export function readEncryptedPendingCookieValue<T extends ExpiringPayload>({
  value,
  secret,
  context,
  nowSeconds,
  parse,
}: ReadEncryptedPendingCookieInput<T>): EncryptedPendingCookieReadResult<T> {
  const parts = value.split(".")
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    return { ok: false, reason: "malformed" }
  }

  const [, encodedIv, encodedCiphertext, encodedTag] = parts
  if (
    !isBase64Url(encodedIv) ||
    !isBase64Url(encodedCiphertext) ||
    !isBase64Url(encodedTag)
  ) {
    return { ok: false, reason: "malformed" }
  }

  const iv = Buffer.from(encodedIv, "base64url")
  const ciphertext = Buffer.from(encodedCiphertext, "base64url")
  const tag = Buffer.from(encodedTag, "base64url")
  if (iv.byteLength !== IV_BYTES || tag.byteLength !== TAG_BYTES) {
    return { ok: false, reason: "malformed" }
  }

  let decoded: unknown
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(secret, context),
      iv
    )
    decipher.setAAD(authenticatedContext(context))
    decipher.setAuthTag(tag)
    decoded = JSON.parse(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        "utf8"
      )
    )
  } catch {
    return { ok: false, reason: "invalid_signature" }
  }

  const payload = parse(decoded)
  if (!payload) return { ok: false, reason: "malformed" }
  if (payload.expiresAt <= nowSeconds) return { ok: false, reason: "expired" }
  return { ok: true, payload }
}

function deriveKey(secret: string, context: PendingCookieContext): Buffer {
  return createHmac("sha256", secret)
    .update(`nabaperks:pending-cookie:${FORMAT_VERSION}:${context}`)
    .digest()
}

function authenticatedContext(context: PendingCookieContext): Buffer {
  return Buffer.from(
    `nabaperks:pending-cookie:${FORMAT_VERSION}:${context}`,
    "utf8"
  )
}

function isBase64Url(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && BASE64URL.test(value)
}
