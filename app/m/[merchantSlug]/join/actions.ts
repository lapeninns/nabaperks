"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import {
  getCurrentCustomer,
  getOrCreateCustomerByVerifiedPhone,
} from "@/lib/customer/identity"
import { captureJoinFunnelEvent } from "@/lib/customer/join-funnel"
import { destinationForReturningQrVisit } from "@/lib/customer/returning-qr-redirect"
import { defaultCountryFromHeaders, normalizePhone } from "@/lib/customer/phone"
import {
  clearPendingPhoneVerification,
  getPendingPhoneVerification,
  setCustomerSession,
  setPendingPhoneVerification,
} from "@/lib/customer/session"
import {
  checkCustomerPhoneVerification,
  startCustomerPhoneVerification,
} from "@/lib/customer/verification"
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import type { GeoCoordinates } from "@/lib/customer/stamp"

export type CustomerIdentityState = {
  fields?: {
    contact?: string
    merchantSlug?: string
    qrId?: string
    phoneOtpSent?: boolean
  }
  errors?: {
    contact?: string
    otp?: string
    form?: string
  }
  message?: string
}

export type CustomerJoinState = {
  errors?: {
    loyaltyTerms?: string
    form?: string
  }
}

const policyVersion = "2026-06-06"

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

export async function requestCustomerIdentityAction(
  _state: CustomerIdentityState,
  formData: FormData
): Promise<CustomerIdentityState> {
  const rawContact = value(formData, "contact")
  const merchantSlug = value(formData, "merchantSlug")
  const qrId = value(formData, "qrId")
  const country = defaultCountryFromHeaders(await headers())
  const normalized = normalizePhone(rawContact, country)

  if (!normalized.ok) {
    return {
      fields: { contact: rawContact, merchantSlug, qrId },
      errors: { contact: normalized.error },
    }
  }

  const contact = normalized.phone.e164

  try {
    await enforceRateLimit({
      key: `customer-identity:${contact.toLowerCase()}`,
      limit: 5,
      windowMs: 15 * 60_000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        fields: { contact, merchantSlug, qrId },
        errors: { form: "Too many verification requests. Try again later." },
      }
    }

    throw error
  }

  await captureJoinFunnelEvent({
    eventName: "join_phone_requested",
    merchantSlug,
    qrId,
    step: "phone",
  })

  try {
    await startCustomerPhoneVerification(contact)
    await setPendingPhoneVerification({
      purpose: "join",
      phone: contact,
      country: normalized.phone.country,
    })
  } catch (error) {
    logVerificationSendFailure("join", error)

    return {
      fields: { contact, merchantSlug, qrId },
      errors: {
        form: "Verification code could not be sent. Try again shortly.",
      },
    }
  }

  redirect(
    `/m/${merchantSlug}/join${qrId ? `?qr=${encodeURIComponent(qrId)}` : ""}`
  )
}

function logVerificationSendFailure(scope: "join", error: unknown): void {
  console.error("Customer verification send failed", {
    scope,
    reason: error instanceof Error ? error.message : "Unknown error",
  })
}

export async function verifyCustomerOtpAction(
  _state: CustomerIdentityState,
  formData: FormData
): Promise<CustomerIdentityState> {
  const merchantSlug = value(formData, "merchantSlug")
  const qrId = value(formData, "qrId")
  const otp = value(formData, "otp")
  const pending = await getPendingPhoneVerification()

  if (!pending || pending.purpose !== "join") {
    return { errors: { contact: "Request a new phone code." } }
  }

  const contact = pending.phone

  if (!/^\d{4,8}$/.test(otp)) {
    return {
      fields: { contact, merchantSlug, qrId, phoneOtpSent: true },
      errors: { otp: "Enter the verification code." },
    }
  }

  const verification = await checkCustomerPhoneVerification(contact, otp)

  if (verification.status !== "approved") {
    return {
      fields: { contact, merchantSlug, qrId, phoneOtpSent: true },
      errors: { form: "That code was not accepted." },
    }
  }

  const customer = await getOrCreateCustomerByVerifiedPhone({
    e164: pending.phone,
    country: pending.country,
    last4: pending.phone.slice(-4),
  })
  await setCustomerSession(customer.id)
  await clearPendingPhoneVerification()
  await captureJoinFunnelEvent({
    eventName: "join_otp_verified",
    customerId: customer.id,
    merchantSlug,
    qrId,
    step: "otp",
  })

  if (qrId) {
    const destination = await destinationForReturningQrVisit(
      merchantSlug,
      qrId,
      {
        issueStamp: true,
        coordinates: coordinates(formData),
      }
    )
    if (destination) redirect(destination)
  }

  redirect(`/m/${merchantSlug}/join${qrId ? `?qr=${qrId}` : ""}`)
}

export async function joinRewardsAction(
  _state: CustomerJoinState,
  formData: FormData
): Promise<CustomerJoinState> {
  const customer = await getCurrentCustomer()
  const merchantSlug = value(formData, "merchantSlug")
  const qrId = value(formData, "qrId")
  const acceptedTerms = formData.get("loyaltyTerms") === "on"
  const marketingOptIn = formData.get("marketingOptIn") === "on"

  if (!customer) {
    return { errors: { form: "Verify your phone before joining." } }
  }

  if (!acceptedTerms) {
    return { errors: { loyaltyTerms: "Accept the loyalty terms to join." } }
  }

  await captureJoinFunnelEvent({
    eventName: "join_terms_accepted",
    customerId: customer.id,
    merchantSlug,
    qrId,
    step: "terms",
    metadata: {
      marketing_opt_in: marketingOptIn,
    },
  })

  const latitude = numberValue(formData, "latitude")
  const longitude = numberValue(formData, "longitude")

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "join_customer_membership_with_first_stamp",
    {
      p_customer_id: customer.id,
      p_merchant_slug: merchantSlug,
      p_qr_id: qrId || null,
      p_marketing_opt_in: marketingOptIn,
      p_policy_version: policyVersion,
      p_latitude: latitude,
      p_longitude: longitude,
    }
  )

  if (error) {
    return {
      errors: {
        form: "Rewards could not be joined. Try again or ask the venue team.",
      },
    }
  }

  const row = data?.[0]
  const membershipId = row?.membership_id
  const firstStampIssued = row?.first_stamp_issued === true
  const geoFlagged = row?.geo_flagged === true

  if (membershipId) {
    await capturePostHogEvent({
      eventName: "customer_joined",
      membershipId,
      actorType: "customer",
      actorId: customer.id,
      metadata: {
        merchant_slug: merchantSlug,
        marketing_opt_in: marketingOptIn,
      },
    })

    if (firstStampIssued) {
      await capturePostHogEvent({
        eventName: "stamp_issued",
        membershipId,
        actorType: "customer",
        actorId: customer.id,
        metadata: {
          merchant_slug: merchantSlug,
          source: "onboarding_first_stamp",
          geo_flagged: geoFlagged,
        },
      })
    }

    // Onboarding completes onto the card itself: a freshly issued first stamp
    // celebrates with `welcome=1&stamp=issued`; a no-QR/direct join lands on a
    // 0-stamp welcome card that invites scanning the venue QR. A QR join whose
    // first stamp was blocked (pool/billing/rate-limit) carries `firststamp=
    // pending` so the welcome copy says to collect it, not that it landed.
    const params = new URLSearchParams({ welcome: "1" })
    if (firstStampIssued) params.set("stamp", "issued")
    else if (qrId) params.set("firststamp", "pending")
    if (geoFlagged) params.set("geo", "flagged")
    redirect(`/card/${membershipId}?${params.toString()}`)
  }

  redirect(
    `/m/${merchantSlug}/join${qrId ? `?qr=${qrId}&` : "?"}membership=existing`
  )
}

function numberValue(formData: FormData, key: string): number | null {
  const raw = value(formData, key)
  if (!raw) return null

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function coordinates(formData: FormData): GeoCoordinates | undefined {
  const latitude = numberValue(formData, "latitude")
  const longitude = numberValue(formData, "longitude")

  if (latitude === null || longitude === null) return undefined

  return { latitude, longitude }
}
