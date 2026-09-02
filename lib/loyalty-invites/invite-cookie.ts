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
 * Encrypted HttpOnly cookie that carries a validated invitation's context from
 * the /invite/[token] landing into the existing merchant join flow. AES-256-GCM
 * with an AAD-bound key derived from CUSTOMER_SESSION_SECRET, format
 * `v1.<iv>.<ciphertext>.<tag>` (base64url), plus an expiry the reader enforces.
 * It stores only the claim token *hash* and display context — never the raw
 * token or the recipient's address.
 */

const COOKIE_NAME = "nabaperks_loyalty_invite"
const FORMAT = "v1"
const IV_BYTES = 12
const AAD = Buffer.from("nabaperks:loyalty-invite-cookie:v1", "utf8")
const TTL_SECONDS = 60 * 60

export type InviteCookieContext = {
  claimTokenHash: string
  merchantSlug: string
  businessName: string
  expiresAt: number
}

export async function setInviteCookie(
  context: Omit<InviteCookieContext, "expiresAt">
): Promise<void> {
  const payload: InviteCookieContext = {
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

export async function readInviteCookie(): Promise<InviteCookieContext | null> {
  const store = await cookies()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return null
  const payload = decrypt(raw)
  if (!payload) return null
  if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return null
  return payload
}

export async function clearInviteCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

function cipherKey(): Buffer {
  return createHmac("sha256", requiredCustomerSessionSecret())
    .update(AAD)
    .digest()
}

function encrypt(payload: InviteCookieContext): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", cipherKey(), iv)
  cipher.setAAD(AAD)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    FORMAT,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".")
}

function decrypt(value: string): InviteCookieContext | null {
  const parts = value.split(".")
  if (parts.length !== 4 || parts[0] !== FORMAT) return null
  const [, ivPart, bodyPart, tagPart] = parts
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      cipherKey(),
      Buffer.from(ivPart, "base64url")
    )
    decipher.setAAD(AAD)
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(bodyPart, "base64url")),
      decipher.final(),
    ]).toString("utf8")
    const parsed = JSON.parse(plaintext) as InviteCookieContext
    if (
      typeof parsed?.claimTokenHash === "string" &&
      typeof parsed?.merchantSlug === "string" &&
      typeof parsed?.businessName === "string" &&
      typeof parsed?.expiresAt === "number"
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}
