import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto"

/**
 * Claim-link material for a merchant offer campaign.
 *
 * The campaign link is printed on a poster and shared, so it must be rotatable
 * without a database migration and unforgeable without the server secret. It is
 * therefore a keyed HMAC-SHA256 derivation of the campaign id and its token
 * generation, domain-separated from every other token in the product. Rotation
 * is simply an increment of the generation: the previous link stops hashing to
 * the stored value the instant the new generation commits.
 *
 * Only two forms are ever written to the database — {@link hashOfferToken}
 * output (a plain SHA-256, the lookup key) and {@link encryptOfferClaimToken}
 * output (an AES-256-GCM copy so the merchant desk can show the link again).
 * The raw token is never persisted.
 *
 * Note that a scan is validated by looking up the stored SHA-256, not by
 * re-deriving. Rotating CUSTOMER_SESSION_SECRET therefore does NOT invalidate
 * outstanding links — every printed poster keeps working — but it does make
 * re-derivation return a token that no longer matches the stored hash. That is
 * exactly why the ciphertext copy exists: it is what lets the merchant desk go
 * on displaying the link that actually works. Use `resolveOfferClaimLink` in
 * `lib/merchant/offer-campaigns.ts` rather than calling
 * {@link offerClaimToken} directly for display.
 */

const secretName = "CUSTOMER_SESSION_SECRET"

const CIPHER_FORMAT = "v1"
const IV_BYTES = 12
const AAD = Buffer.from("nabaperks:offer-campaign:v1:link", "utf8")

/**
 * The campaign link token for one generation. Deriving the same pair twice
 * always yields the same token, so a merchant reopening the poster screen sees
 * the link they printed rather than a new one.
 */
export function offerClaimToken(
  campaignId: string,
  generation: number
): string {
  const id = campaignId.trim()
  if (!id) {
    throw new Error("A campaign id is required for an offer claim token.")
  }
  if (!Number.isInteger(generation) || generation < 1) {
    throw new Error("An offer token generation must be a whole number from 1.")
  }

  return createHmac("sha256", requiredSecret())
    .update(`nabaperks:offer-campaign:v1:claim:${id}:${generation}`)
    .digest("base64url")
}

/** SHA-256 hex of a token — the only lookup form written to the database. */
export function hashOfferToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export type OfferClaimTokenSet = {
  readonly campaignId: string
  readonly generation: number
  readonly claimToken: string
  readonly claimTokenHash: string
  readonly claimTokenCiphertext: string
}

/**
 * Everything `rotate_offer_campaign_token` needs for one generation. The RPC
 * stores the hash and the ciphertext together and returns the generation it
 * settled on, which callers must compare with the one derived here.
 */
export function offerClaimTokenSet(
  campaignId: string,
  generation: number
): OfferClaimTokenSet {
  const claimToken = offerClaimToken(campaignId, generation)
  return {
    campaignId,
    generation,
    claimToken,
    claimTokenHash: hashOfferToken(claimToken),
    claimTokenCiphertext: encryptOfferClaimToken(claimToken),
  }
}

/** AES-256-GCM, key derived from the same secret, format `v1.<iv>.<ct>.<tag>`. */
export function encryptOfferClaimToken(token: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", cipherKey(), iv)
  cipher.setAAD(AAD)
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()])
  return [
    CIPHER_FORMAT,
    iv.toString("base64url"),
    body.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".")
}

/** Returns null for anything that is not an intact ciphertext from this key. */
export function decryptOfferClaimToken(value: string): string | null {
  const parts = value.split(".")
  if (parts.length !== 4 || parts[0] !== CIPHER_FORMAT) return null
  const [, ivPart, bodyPart, tagPart] = parts
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      cipherKey(),
      Buffer.from(ivPart, "base64url")
    )
    decipher.setAAD(AAD)
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"))
    return Buffer.concat([
      decipher.update(Buffer.from(bodyPart, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    return null
  }
}

function cipherKey(): Buffer {
  return createHmac("sha256", requiredSecret()).update(AAD).digest()
}

function requiredSecret(): string {
  const value = process.env[secretName]?.trim()
  if (!value) {
    throw new Error(`${secretName} is required for offer campaign links.`)
  }
  return value
}
