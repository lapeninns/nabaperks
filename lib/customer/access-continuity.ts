import "server-only"

import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto"

import { headers } from "next/headers"

import { customerEmailHmac } from "@/lib/customer/email-pii-core"
import type { CurrentCustomer } from "@/lib/customer/identity"
import {
  clearPendingAccessRecovery,
  clearPendingPhoneVerification,
  getPendingAccessRecovery,
  setCustomerSession,
  setPendingAccessRecovery,
} from "@/lib/customer/session"
import { sendEmailOtp } from "@/lib/notifications/resend"
import { requiredCustomerSessionSecret } from "@/lib/security/customer-session-secret"
import {
  customerDeviceHashFromHeaders,
  enforceRateLimit,
} from "@/lib/security/rate-limit"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

type EstablishCustomerAccessInput = {
  customer: CurrentCustomer
  customerWasCreated: boolean
  phoneHmac: string
  next: string
}

type CustomerAccessRecoveryCheck =
  | {
      status: "approved"
      customerId: string
      next: string
      sessionId: string
    }
  | { status: "rejected" }
  | { status: "unavailable" }

type RecoveryCustomerRow = {
  id: string
  email: string | null
  email_hmac: string | null
  email_verified_at: string | null
  phone_hmac: string | null
}

type RecoveryChannelCustomer = Pick<
  CurrentCustomer,
  "email" | "emailVerifiedAt" | "id"
>

export async function establishCustomerSessionAfterVerifiedPhone({
  customer,
  customerWasCreated,
  phoneHmac,
  next,
}: EstablishCustomerAccessInput): Promise<"authenticated" | "recovery"> {
  const deviceHash = customerDeviceHashFromHeaders(await headers())
  if (!deviceHash) {
    throw new Error("A verified customer device is required.")
  }

  if (customerWasCreated) {
    await setCustomerSession(customer.id, "new_identity")
    return "authenticated"
  }

  if (await customerDeviceIsRecognised(customer.id, deviceHash)) {
    await setCustomerSession(customer.id, "recognised_device")
    return "authenticated"
  }

  await startCustomerAccessRecovery({
    customer,
    phoneHmac,
    deviceHash,
    next,
  })
  await clearPendingPhoneVerification()
  return "recovery"
}

export async function verifyCustomerAccessRecovery(
  code: string
): Promise<CustomerAccessRecoveryCheck> {
  const pending = await boundRecoveryAttempt()
  if (!pending || !pending.codeHmac || !pending.emailHmac) {
    return { status: "unavailable" }
  }
  const pendingCodeHmac = pending.codeHmac
  const pendingEmailHmac = pending.emailHmac

  await enforceRateLimit({
    key: `customer-access-recovery-check:${pending.customerId}:${pending.deviceHash}`,
    limit: 5,
    windowMs: 15 * 60_000,
  })

  const customer = await recoveryCustomer(pending.customerId)
  if (
    !customer ||
    !recoveryChannelStillMatches(customer, {
      phoneHmac: pending.phoneHmac,
      emailHmac: pendingEmailHmac,
    })
  ) {
    await clearPendingAccessRecovery()
    return { status: "unavailable" }
  }

  const approved =
    isApprovedDevOtp(code) ||
    safeEqual(
      codeHmac({
        customerId: pending.customerId,
        deviceHash: pending.deviceHash,
        email: customer.email ?? "",
        code,
      }),
      pendingCodeHmac
    )
  if (!approved) return { status: "rejected" }

  return {
    status: "approved",
    customerId: pending.customerId,
    next: pending.next,
    sessionId: pending.sessionId,
  }
}

export async function resendCustomerAccessRecovery(): Promise<boolean> {
  const pending = await boundRecoveryAttempt()
  if (!pending) return false

  const customer = await recoveryCustomer(pending.customerId)
  if (!customer || !recoveryPhoneStillMatches(customer, pending.phoneHmac)) {
    await clearPendingAccessRecovery()
    return false
  }

  const currentCustomer = recoveryCurrentCustomer(customer)
  if (!currentCustomer) return false

  await startCustomerAccessRecovery({
    customer: currentCustomer,
    phoneHmac: pending.phoneHmac,
    deviceHash: pending.deviceHash,
    next: pending.next,
  })
  return true
}

async function customerDeviceIsRecognised(
  customerId: string,
  deviceHash: string
): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "customer_auth_device_is_trusted",
    {
      p_customer_id: customerId,
      p_device_hash: deviceHash,
    }
  )
  if (error) {
    throw new Error(`Unable to verify customer device: ${error.message}`)
  }
  return data === true
}

async function startCustomerAccessRecovery({
  customer,
  phoneHmac,
  deviceHash,
  next,
}: {
  customer: RecoveryChannelCustomer
  phoneHmac: string
  deviceHash: string
  next: string
}): Promise<void> {
  const verifiedEmail =
    customer.email?.trim() && customer.emailVerifiedAt
      ? customer.email.trim().toLowerCase()
      : null

  if (!verifiedEmail) {
    await setPendingAccessRecovery({
      sessionId: randomUUID(),
      customerId: customer.id,
      phoneHmac,
      deviceHash,
      emailHmac: null,
      codeHmac: null,
      next,
    })
    return
  }

  await enforceRateLimit({
    key: `customer-access-recovery-send:customer:${customer.id}`,
    limit: 6,
    windowMs: 24 * 60 * 60_000,
  })
  await enforceRateLimit({
    key: `customer-access-recovery-send:${customerEmailHmac(verifiedEmail)}`,
    limit: 3,
    windowMs: 15 * 60_000,
  })

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
  await setPendingAccessRecovery({
    sessionId: randomUUID(),
    customerId: customer.id,
    phoneHmac,
    deviceHash,
    emailHmac: customerEmailHmac(verifiedEmail),
    codeHmac: codeHmac({
      customerId: customer.id,
      deviceHash,
      email: verifiedEmail,
      code,
    }),
    next,
  })

  try {
    await sendEmailOtp({ to: verifiedEmail, code })
  } catch (error) {
    await clearPendingAccessRecovery()
    throw error
  }
}

async function boundRecoveryAttempt() {
  const pending = await getPendingAccessRecovery()
  if (!pending) return null

  const deviceHash = customerDeviceHashFromHeaders(await headers())
  if (!deviceHash || !safeEqual(deviceHash, pending.deviceHash)) {
    await clearPendingAccessRecovery()
    return null
  }
  return pending
}

async function recoveryCustomer(
  customerId: string
): Promise<RecoveryCustomerRow | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customers")
    .select("id, email, email_hmac, email_verified_at, phone_hmac")
    .eq("id", customerId)
    .maybeSingle()
  if (error) {
    throw new Error(`Unable to load recovery customer: ${error.message}`)
  }
  return data
}

function recoveryChannelStillMatches(
  customer: RecoveryCustomerRow,
  pending: {
    phoneHmac: string
    emailHmac: string
  }
): boolean {
  const email = customer.email?.trim().toLowerCase()
  if (!email || !customer.email_verified_at) return false
  const currentEmailHmac = customerEmailHmac(email)
  return (
    recoveryPhoneStillMatches(customer, pending.phoneHmac) &&
    safeEqual(currentEmailHmac, pending.emailHmac) &&
    (!customer.email_hmac || safeEqual(customer.email_hmac, currentEmailHmac))
  )
}

function recoveryPhoneStillMatches(
  customer: RecoveryCustomerRow,
  phoneHmac: string
): boolean {
  return Boolean(
    customer.phone_hmac && safeEqual(customer.phone_hmac, phoneHmac)
  )
}

function recoveryCurrentCustomer(
  customer: RecoveryCustomerRow
): RecoveryChannelCustomer | null {
  if (!customer.email || !customer.email_verified_at) return null
  return {
    id: customer.id,
    email: customer.email,
    emailVerifiedAt: customer.email_verified_at,
  }
}

function codeHmac({
  customerId,
  deviceHash,
  email,
  code,
}: {
  customerId: string
  deviceHash: string
  email: string
  code: string
}): string {
  return createHmac("sha256", requiredCustomerSessionSecret())
    .update("nabaperks:customer-access-recovery:v1")
    .update("\0")
    .update(customerId)
    .update("\0")
    .update(deviceHash)
    .update("\0")
    .update(email.trim().toLowerCase())
    .update("\0")
    .update(code)
    .digest("hex")
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return (
    leftBuffer.byteLength === rightBuffer.byteLength &&
    timingSafeEqual(leftBuffer, rightBuffer)
  )
}

function isApprovedDevOtp(code: string): boolean {
  const devCode = process.env.CUSTOMER_DEV_OTP_CODE?.trim()
  return (
    process.env.NODE_ENV !== "production" &&
    Boolean(devCode) &&
    code === devCode
  )
}
