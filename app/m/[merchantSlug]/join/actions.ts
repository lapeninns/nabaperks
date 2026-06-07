"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { getCurrentUser } from "@/lib/auth/session"
import { getServerEnv } from "@/lib/env/server"
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type CustomerIdentityState = {
  fields?: {
    contact?: string
    merchantSlug?: string
    qrId?: string
    emailOtpSent?: boolean
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

function isEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)
}

function isPhone(input: string) {
  return /^\+[1-9]\d{7,14}$/.test(input)
}

function formatAuthError(message: string) {
  if (/email rate limit exceeded/i.test(message)) {
    return "Too many verification emails were sent. Check your inbox for an earlier link, or wait about an hour before trying again."
  }

  return message
}

export async function requestCustomerIdentityAction(
  _state: CustomerIdentityState,
  formData: FormData
): Promise<CustomerIdentityState> {
  const contact = value(formData, "contact")
  const merchantSlug = value(formData, "merchantSlug")
  const qrId = value(formData, "qrId")

  if (!isEmail(contact) && !isPhone(contact)) {
    return {
      fields: { contact, merchantSlug, qrId },
      errors: { contact: "Enter an email address or E.164 phone number." },
    }
  }

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

  const supabase = await createSupabaseServerClient()
  const env = getServerEnv()
  const next = `/m/${merchantSlug}/join${qrId ? `?qr=${qrId}` : ""}`

  if (isEmail(contact)) {
    const { error } = await supabase.auth.signInWithOtp({
      email: contact.toLowerCase(),
      options: {
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=${encodeURIComponent(
          next
        )}`,
      },
    })

    if (error) {
      return {
        fields: { contact, merchantSlug, qrId },
        errors: { form: formatAuthError(error.message) },
      }
    }

    return {
      fields: { contact, merchantSlug, qrId, emailOtpSent: true },
      message: "Check your email to continue joining rewards.",
    }
  }

  const { error } = await supabase.auth.signInWithOtp({ phone: contact })

  if (error) {
    return {
      fields: { contact, merchantSlug, qrId },
      errors: { form: error.message },
    }
  }

  return {
    fields: { contact, merchantSlug, qrId, phoneOtpSent: true },
    message: "Enter the verification code sent to your phone.",
  }
}

export async function verifyCustomerPhoneOtpAction(
  _state: CustomerIdentityState,
  formData: FormData
): Promise<CustomerIdentityState> {
  const contact = value(formData, "contact")
  const merchantSlug = value(formData, "merchantSlug")
  const qrId = value(formData, "qrId")
  const otp = value(formData, "otp")

  if (!isPhone(contact)) {
    return { errors: { contact: "Enter the phone number again." } }
  }

  if (!/^\d{4,8}$/.test(otp)) {
    return {
      fields: { contact, merchantSlug, qrId, phoneOtpSent: true },
      errors: { otp: "Enter the verification code." },
    }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({
    phone: contact,
    token: otp,
    type: "sms",
  })

  if (error) {
    return {
      fields: { contact, merchantSlug, qrId, phoneOtpSent: true },
      errors: { form: "That code was not accepted." },
    }
  }

  redirect(`/m/${merchantSlug}/join${qrId ? `?qr=${qrId}` : ""}`)
}

export async function joinRewardsAction(
  _state: CustomerJoinState,
  formData: FormData
): Promise<CustomerJoinState> {
  const user = await getCurrentUser()
  const merchantSlug = value(formData, "merchantSlug")
  const qrId = value(formData, "qrId")
  const acceptedTerms = formData.get("loyaltyTerms") === "on"
  const marketingOptIn = formData.get("marketingOptIn") === "on"

  if (!user) {
    return { errors: { form: "Verify your email or phone before joining." } }
  }

  if (!acceptedTerms) {
    return { errors: { loyaltyTerms: "Accept the loyalty terms to join." } }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("join_customer_membership", {
    p_merchant_slug: merchantSlug,
    p_qr_id: qrId || null,
    p_marketing_opt_in: marketingOptIn,
    p_policy_version: policyVersion,
  })

  if (error) {
    return { errors: { form: `Rewards could not be joined: ${error.message}` } }
  }

  const membershipId = data?.[0]?.membership_id

  if (membershipId) {
    await capturePostHogEvent({
      eventName: "customer_joined",
      membershipId,
      actorType: "customer",
      actorId: user.id,
      metadata: {
        merchant_slug: merchantSlug,
        marketing_opt_in: marketingOptIn,
      },
    })
    redirect(`/card/${membershipId}`)
  }

  redirect(`/m/${merchantSlug}/join${qrId ? `?qr=${qrId}&` : "?"}membership=existing`)
}
