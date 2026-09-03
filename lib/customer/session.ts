import "server-only"

import { randomUUID } from "node:crypto"

import { cache } from "react"

import { cookies, headers } from "next/headers"

import { customerPhoneHmac } from "@/lib/customer/phone-pii"
import {
  createCustomerSessionCookieValue,
  createPendingAccessRecoveryCookieValue,
  createPendingEmailCookieValue,
  createPendingPhoneCookieValue,
  readCustomerSessionCookieValue,
  readPendingAccessRecoveryCookieValue,
  readPendingEmailCookieValue,
  readPendingPhoneCookieValue,
  type CustomerSessionPayload,
  type PendingAccessRecoveryPayload,
  type PendingEmailPayload,
  type PendingPhonePayload,
  type PendingPhonePurpose,
} from "@/lib/customer/session-cookie"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { requiredCustomerSessionSecret } from "@/lib/security/customer-session-secret"
import { customerDeviceHashFromHeaders } from "@/lib/security/rate-limit"

export const pendingPhoneCookieName = "nabaperks_pending_phone"
export const pendingEmailCookieName = "nabaperks_pending_email"
export const pendingAccessRecoveryCookieName = "nabaperks_access_recovery"
export const customerSessionCookieName = "nabaperks_customer_session"

type PendingPhoneInput = {
  purpose: PendingPhonePurpose
  phone: string
  country: string
}

type PendingEmailInput = {
  email: string
  codeHmac: string
  customerId?: string | null
}

type PendingAccessRecoveryInput = Omit<
  PendingAccessRecoveryPayload,
  "version" | "issuedAt" | "expiresAt"
>

const pendingPhoneTtlSeconds = 10 * 60
const pendingEmailTtlSeconds = 10 * 60
const pendingAccessRecoveryTtlSeconds = 10 * 60
const customerSessionTtlSeconds = 30 * 24 * 60 * 60

export async function setPendingPhoneVerification(
  input: PendingPhoneInput
): Promise<PendingPhonePayload> {
  const issuedAt = nowSeconds()
  const payload: PendingPhonePayload = {
    version: 2,
    purpose: input.purpose,
    phone: input.phone,
    phoneHmac: customerPhoneHmac(input.phone),
    country: input.country,
    issuedAt,
    expiresAt: issuedAt + pendingPhoneTtlSeconds,
  }
  const cookieStore = await cookies()
  cookieStore.set(
    pendingPhoneCookieName,
    createPendingPhoneCookieValue(payload, requiredCustomerSessionSecret()),
    cookieOptions(pendingPhoneTtlSeconds)
  )

  return payload
}

export async function getPendingPhoneVerification(): Promise<PendingPhonePayload | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(pendingPhoneCookieName)?.value
  if (!value) return null

  const result = readPendingPhoneCookieValue(
    value,
    requiredCustomerSessionSecret(),
    nowSeconds()
  )
  return result.ok ? result.payload : null
}

export async function clearPendingPhoneVerification(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(pendingPhoneCookieName)
}

export async function setPendingEmailVerification(
  input: PendingEmailInput
): Promise<PendingEmailPayload> {
  const issuedAt = nowSeconds()
  const payload: PendingEmailPayload = {
    version: 1,
    email: input.email,
    codeHmac: input.codeHmac,
    customerId: input.customerId ?? null,
    issuedAt,
    expiresAt: issuedAt + pendingEmailTtlSeconds,
  }
  const cookieStore = await cookies()
  cookieStore.set(
    pendingEmailCookieName,
    createPendingEmailCookieValue(payload, requiredCustomerSessionSecret()),
    cookieOptions(pendingEmailTtlSeconds)
  )

  return payload
}

export async function getPendingEmailVerification(): Promise<PendingEmailPayload | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(pendingEmailCookieName)?.value
  if (!value) return null

  const result = readPendingEmailCookieValue(
    value,
    requiredCustomerSessionSecret(),
    nowSeconds()
  )
  return result.ok ? result.payload : null
}

export async function clearPendingEmailVerification(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(pendingEmailCookieName)
}

export async function setPendingAccessRecovery(
  input: PendingAccessRecoveryInput
): Promise<PendingAccessRecoveryPayload> {
  const issuedAt = nowSeconds()
  const payload: PendingAccessRecoveryPayload = {
    version: 1,
    ...input,
    issuedAt,
    expiresAt: issuedAt + pendingAccessRecoveryTtlSeconds,
  }
  const cookieStore = await cookies()
  cookieStore.set(
    pendingAccessRecoveryCookieName,
    createPendingAccessRecoveryCookieValue(
      payload,
      requiredCustomerSessionSecret()
    ),
    cookieOptions(pendingAccessRecoveryTtlSeconds)
  )
  return payload
}

export async function getPendingAccessRecovery(): Promise<PendingAccessRecoveryPayload | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(pendingAccessRecoveryCookieName)?.value
  if (!value) return null

  const result = readPendingAccessRecoveryCookieValue(
    value,
    requiredCustomerSessionSecret(),
    nowSeconds()
  )
  return result.ok ? result.payload : null
}

export async function clearPendingAccessRecovery(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(pendingAccessRecoveryCookieName)
}

export type CustomerSessionContinuitySource =
  "new_identity" | "recognised_device" | "verified_email"

export async function setCustomerSession(
  customerId: string,
  continuitySource: CustomerSessionContinuitySource,
  sessionId: string = randomUUID()
): Promise<CustomerSessionPayload> {
  const issuedAt = nowSeconds()
  const expiresAt = issuedAt + customerSessionTtlSeconds
  const payload: CustomerSessionPayload = {
    version: 2,
    sessionId,
    customerId,
    issuedAt,
    expiresAt,
  }
  await registerCustomerSession(payload, continuitySource)

  const cookieStore = await cookies()
  cookieStore.set(
    customerSessionCookieName,
    createCustomerSessionCookieValue(payload, requiredCustomerSessionSecret()),
    cookieOptions(customerSessionTtlSeconds)
  )

  return payload
}

// Memoized per request: on the customer home path the session is resolved by
// the authed layout AND again inside getCurrentCustomer, which otherwise fires
// the touch_customer_session RPC twice per page. cache() dedupes it to a single
// touch per request — touching once is the correct semantic, not a regression.
export const getCustomerSession = cache(
  async (): Promise<CustomerSessionPayload | null> => {
    const cookieStore = await cookies()
    const value = cookieStore.get(customerSessionCookieName)?.value
    if (!value) return null

    const result = readCustomerSessionCookieValue(
      value,
      requiredCustomerSessionSecret(),
      nowSeconds()
    )
    if (!result.ok) return null

    const active = await isCustomerSessionActive(result.payload)
    return active ? result.payload : null
  }
)

export async function clearCustomerSession(): Promise<void> {
  const cookieStore = await cookies()
  const value = cookieStore.get(customerSessionCookieName)?.value
  if (value) {
    const result = readCustomerSessionCookieValue(
      value,
      requiredCustomerSessionSecret(),
      nowSeconds()
    )
    if (result.ok) {
      await revokeCustomerSession(result.payload)
    }
  }
  cookieStore.delete(customerSessionCookieName)
}

async function registerCustomerSession(
  payload: CustomerSessionPayload,
  continuitySource: CustomerSessionContinuitySource
): Promise<void> {
  const deviceHash = customerDeviceHashFromHeaders(await headers())
  if (!deviceHash) {
    throw new Error(
      "Unable to register customer session without a verified device."
    )
  }
  const supabase = createSupabaseServiceRoleClient()
  const expiresAt = new Date(payload.expiresAt * 1000).toISOString()
  const { error } = await supabase.rpc("register_customer_session", {
    p_customer_id: payload.customerId,
    p_session_id: payload.sessionId,
    p_expires_at: expiresAt,
    p_device_hash: deviceHash,
    p_continuity_source: continuitySource,
  })

  if (error) {
    throw new Error(`Unable to register customer session: ${error.message}`)
  }
}

async function isCustomerSessionActive(
  payload: CustomerSessionPayload
): Promise<boolean> {
  const deviceHash = customerDeviceHashFromHeaders(await headers())
  if (!deviceHash) return false
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("touch_customer_session", {
    p_customer_id: payload.customerId,
    p_session_id: payload.sessionId,
    p_device_hash: deviceHash,
  })

  if (error) {
    throw new Error(`Unable to verify customer session: ${error.message}`)
  }

  return data === true
}

async function revokeCustomerSession(
  payload: CustomerSessionPayload
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("revoke_customer_session", {
    p_customer_id: payload.customerId,
    p_session_id: payload.sessionId,
  })

  if (error) {
    throw new Error(`Unable to revoke customer session: ${error.message}`)
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  }
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}
