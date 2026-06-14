import "server-only"

import { cookies } from "next/headers"

import { customerPhoneHmac } from "@/lib/customer/phone-pii"
import {
  createCustomerSessionCookieValue,
  createPendingPhoneCookieValue,
  readCustomerSessionCookieValue,
  readPendingPhoneCookieValue,
  type CustomerSessionPayload,
  type PendingPhonePayload,
  type PendingPhonePurpose,
} from "@/lib/customer/session-cookie"

export const pendingPhoneCookieName = "nabaperks_pending_phone"
export const customerSessionCookieName = "nabaperks_customer_session"

type PendingPhoneInput = {
  purpose: PendingPhonePurpose
  phone: string
  country: string
  customerId?: string | null
}

const pendingPhoneTtlSeconds = 10 * 60
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

export async function setCustomerSession(
  customerId: string
): Promise<CustomerSessionPayload> {
  const issuedAt = nowSeconds()
  const payload: CustomerSessionPayload = {
    version: 1,
    customerId,
    issuedAt,
    expiresAt: issuedAt + customerSessionTtlSeconds,
  }
  const cookieStore = await cookies()
  cookieStore.set(
    customerSessionCookieName,
    createCustomerSessionCookieValue(payload, customerSessionSecret()),
    cookieOptions(customerSessionTtlSeconds)
  )

  return payload
}

export async function getCustomerSession(): Promise<CustomerSessionPayload | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(customerSessionCookieName)?.value
  if (!value) return null

  const result = readCustomerSessionCookieValue(
    value,
    customerSessionSecret(),
    nowSeconds()
  )
  return result.ok ? result.payload : null
}

export async function clearCustomerSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(customerSessionCookieName)
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
