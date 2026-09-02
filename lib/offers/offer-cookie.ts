import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto"

import { cookies } from "next/headers"

import { requiredCustomerSessionSecret } from "@/lib/security/customer-session-secret"

/**
 * Encrypted HttpOnly handoff from the /offer/[token] landing into the existing
 * merchant join flow.
 *
 * The campaign link is a shared secret printed on a poster, so it never travels
 * any further than the landing page: this cookie carries the token's SHA-256
 * HASH — the same form the database stores — plus the venue slug the claim is
 * bound to, and nothing else. No raw token, no benefit values, no customer.
 * A stolen cookie is therefore worth no more than a photograph of the poster,
 * and the slug lets the join action refuse a cookie minted for another venue.
 *
 * AES-256-GCM with an AAD-bound key derived from CUSTOMER_SESSION_SECRET,
 * serialised as `v1.<iv>.<ciphertext>.<tag>` in base64url, plus an absolute
 * expiry the reader enforces independently of the browser's own cookie maxAge.
 */

const COOKIE_NAME = "nabaperks_offer_claim"
const FORMAT = "v1"
const IV_BYTES = 12
const AAD = Buffer.from("nabaperks:offer-claim-cookie:v1", "utf8")
const TTL_SECONDS = 60 * 60
const FIELD_SEPARATOR = "|"

export type OfferCookieContext = {
  /** SHA-256 hex of the claim token, exactly as offer_campaigns stores it. */
  readonly claimTokenHash: string
  /** The venue the claim belongs to; the join action refuses any other. */
  readonly merchantSlug: string
  /** Unix seconds after which the reader discards the cookie. */
  readonly expiresAt: number
}

export async function setOfferCookie(
  context: Omit<OfferCookieContext, "expiresAt">
): Promise<void> {
  const payload: OfferCookieContext = {
    ...context,
    expiresAt: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  }
  const store = await cookies()
  store.set(COOKIE_NAME, encrypt(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  })
}

export async function readOfferCookie(): Promise<OfferCookieContext | null> {
  const store = await cookies()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return null
  const payload = decrypt(raw)
  if (!payload) return null
  if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return null
  return payload
}

export async function clearOfferCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

function cipherKey(): Buffer {
  return createHmac("sha256", requiredCustomerSessionSecret())
    .update(AAD)
    .digest()
}

/**
 * The three fields have disjoint alphabets — hex, a slug, digits — so a
 * separated tuple is unambiguous and avoids parsing attacker-influenced JSON
 * after decryption.
 */
function encrypt(payload: OfferCookieContext): string {
  const body = [
    payload.claimTokenHash,
    payload.merchantSlug,
    String(payload.expiresAt),
  ].join(FIELD_SEPARATOR)

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", cipherKey(), iv)
  cipher.setAAD(AAD)
  const sealed = Buffer.concat([cipher.update(body, "utf8"), cipher.final()])
  return [
    FORMAT,
    iv.toString("base64url"),
    sealed.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".")
}

function decrypt(value: string): OfferCookieContext | null {
  const parts = value.split(".")
  if (parts.length !== 4 || parts[0] !== FORMAT) return null
  const [, ivPart, bodyPart, tagPart] = parts

  let plaintext: string
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      cipherKey(),
      Buffer.from(ivPart, "base64url")
    )
    decipher.setAAD(AAD)
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"))
    plaintext = Buffer.concat([
      decipher.update(Buffer.from(bodyPart, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    return null
  }

  const fields = plaintext.split(FIELD_SEPARATOR)
  if (fields.length !== 3) return null
  const [claimTokenHash, merchantSlug, expiry] = fields
  const expiresAt = Number(expiry)
  if (
    !/^[a-f0-9]{64}$/.test(claimTokenHash) ||
    merchantSlug === "" ||
    !Number.isSafeInteger(expiresAt)
  ) {
    return null
  }

  return { claimTokenHash, merchantSlug, expiresAt }
}
