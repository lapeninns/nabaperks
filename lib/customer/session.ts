import "server-only"

import { randomUUID } from "node:crypto"

import { cache } from "react"

import { cookies } from "next/headers"

import { customerPhoneHmac } from "@/lib/customer/phone-pii"
import {
  createCustomerSessionCookieValue,
  createPendingEmailCookieValue,
  createPendingPhoneCookieValue,
  readCustomerSessionCookieValue,
  readPendingEmailCookieValue,
  readPendingPhoneCookieValue,
  type CustomerSessionPayload,
  type PendingEmailPayload,
  type PendingPhonePayload,
  type PendingPhonePurpose,
} from "@/lib/customer/session-cookie"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const pendingPhoneCookieName = "nabaperks_pending_phone"
export const pendingEmailCookieName = "nabaperks_pending_email"
export const customerSessionCookieName = "nabaperks_customer_session"

type PendingPhoneInput = {
  purpose: PendingPhonePurpose
  phone: string
  country: string
  customerId?: string | null
}

type PendingEmailInput = {
  email: string
  codeHmac: string
  customerId?: string | null
}

const pendingPhoneTtlSeconds = 10 * 60
const pendingEmailTtlSeconds = 10 * 60
const customerSessionTtlSeconds = 30 * 24 * 60 * 60

export async function setPendingPhoneVerification(
  input: PendingPhoneInput
): Promise<PendingPhonePayload> {
  const issuedAt = nowSeconds()
  const payload: PendingPhonePayload = {
    version: 1,
    purpose: input.purpose,
    phone: input.phone,
    phoneHmac: customerPhoneHmac(input.phone),
    country: input.country,
    customerId: input.customerId ?? null,
    issuedAt,
    expiresAt: issuedAt + pendingPhoneTtlSeconds,
  }
  const cookieStore = await cookies()
  cookieStore.set(
    pendingPhoneCookieName,
    createPendingPhoneCookieValue(payload, customerSessionSecret()),
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
    customerSessionSecret(),
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
    createPendingEmailCookieValue(payload, customerSessionSecret()),
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
    customerSessionSecret(),
    nowSeconds()
  )
  return result.ok ? result.payload : null
}

export async function clearPendingEmailVerification(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(pendingEmailCookieName)
}

export async function setCustomerSession(
  customerId: string
): Promise<CustomerSessionPayload> {
  const issuedAt = nowSeconds()
  const expiresAt = issuedAt + customerSessionTtlSeconds
  const payload: CustomerSessionPayload = {
    version: 2,
    sessionId: randomUUID(),
    customerId,
    issuedAt,
    expiresAt,
  }
  await registerCustomerSession(payload)

  const cookieStore = await cookies()
  cookieStore.set(
    customerSessionCookieName,
    createCustomerSessionCookieValue(payload, customerSessionSecret()),
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
      customerSessionSecret(),
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
      customerSessionSecret(),
      nowSeconds()
    )
    if (result.ok) {
      await revokeCustomerSession(result.payload)
    }
  }
  cookieStore.delete(customerSessionCookieName)
}

async function registerCustomerSession(
  payload: CustomerSessionPayload
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  const expiresAt = new Date(payload.expiresAt * 1000).toISOString()
  const { error } = await supabase.rpc("register_customer_session", {
    p_customer_id: payload.customerId,
    p_session_id: payload.sessionId,
    p_expires_at: expiresAt,
  })

  if (error) {
    throw new Error(`Unable to register customer session: ${error.message}`)
  }
}

async function isCustomerSessionActive(
  payload: CustomerSessionPayload
): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("touch_customer_session", {
    p_customer_id: payload.customerId,
    p_session_id: payload.sessionId,
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

function customerSessionSecret(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET?.trim()

  if (!secret) {
    throw new Error(
      "CUSTOMER_SESSION_SECRET is required for customer sessions."
    )
  }

  return secret
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
