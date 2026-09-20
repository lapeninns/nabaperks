"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"

import { triggerBirthdayIssuanceForCustomer } from "@/lib/rewards/issue-birthday"
import {
  isMarketingChannel,
  updateCustomerMarketingConsent,
  type MarketingChannel,
} from "@/lib/customer/consent"
import {
  checkCustomerEmailVerification,
  startCustomerEmailVerification,
} from "@/lib/customer/email-verification"
import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  clearCustomerEmail,
  markCustomerEmailVerified,
  updateCustomerProfile,
} from "@/lib/customer/profile"
import { validateProfileFields } from "@/lib/customer/profile-fields"
import { clearPendingEmailVerification } from "@/lib/customer/session"
import { RateLimitError } from "@/lib/security/rate-limit"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

const PROFILE_PATH = "/home/profile"

export type ProfileEditState = {
  fields?: {
    fullName?: string
    dateOfBirth?: string
    email?: string
  }
  errors?: {
    fullName?: string
    dateOfBirth?: string
    email?: string
    otp?: string
    form?: string
  }
  message?: string
}

/**
 * Save the customer's profile from the /home editor. Reuses the same helpers and
 * validation as the redeem-time gate; only the revalidation target differs. A new
 * email starts verification and the page re-renders to show the confirm step.
 */
export async function saveHomeProfileAction(
  _state: ProfileEditState,
  formData: FormData
): Promise<ProfileEditState> {
  const fullName = value(formData, "fullName")
  const dateOfBirth = value(formData, "dateOfBirth")
  const email = value(formData, "email")
  const fields = { fullName, dateOfBirth, email }

  const errors = validateProfileFields({ fullName, dateOfBirth, email })
  if (Object.keys(errors).length > 0) return { fields, errors }

  let emailVerificationRequired = false
  let savedEmail: string | null = null
  try {
    const result = await updateCustomerProfile({
      fullName,
      dateOfBirth,
      email: email || null,
    })
    emailVerificationRequired = result.emailVerificationRequired
    savedEmail = result.email
  } catch {
    return {
      fields,
      errors: { form: "We couldn't save your details. Try again." },
    }
  }

  // A saved DOB may make the member eligible for a birthday reward this month;
  // issue it best-effort after the response (covers both success branches below).
  if (dateOfBirth) {
    const customer = await getCurrentCustomer()
    if (customer) {
      after(() => triggerBirthdayIssuanceForCustomer(customer.id))
    }
  }

  if (emailVerificationRequired && savedEmail) {
    try {
      await startCustomerEmailVerification(savedEmail)
    } catch {
      return {
        fields,
        errors: {
          email: "We couldn't email a code to that address. Try again.",
        },
      }
    }
    revalidatePath(PROFILE_PATH)
    return {
      fields,
      message: "Enter the code we sent to your email to confirm it.",
    }
  }

  revalidatePath(PROFILE_PATH)
  return { fields, message: "Your details are saved." }
}

export async function verifyHomeProfileEmailAction(
  _state: ProfileEditState,
  formData: FormData
): Promise<ProfileEditState> {
  const code = value(formData, "otp")
  if (!code) return { errors: { otp: "Enter the code from your email." } }

  let result: Awaited<ReturnType<typeof checkCustomerEmailVerification>>
  try {
    result = await checkCustomerEmailVerification(code)
  } catch {
    return { errors: { form: "We couldn't check that code. Try again." } }
  }

  if (result.status !== "approved") {
    return {
      errors: {
        otp: "That code didn't match. Check your email and try again.",
      },
    }
  }

  try {
    await markCustomerEmailVerified(result.email)
  } catch {
    return { errors: { form: "We couldn't confirm your email. Try again." } }
  }

  revalidatePath(PROFILE_PATH)
  return { message: "Your email is confirmed." }
}

export type MarketingConsentState = {
  channel?: MarketingChannel
  optedIn?: boolean
  error?: string
}

/**
 * Toggles one global marketing channel for the signed-in customer. Each profile
 * toggle posts here on change (no Save button); the RPC writes an append-only
 * record per membership and the page revalidates to reflect the new standing.
 */
export async function updateHomeMarketingConsentAction(
  _state: MarketingConsentState,
  formData: FormData
): Promise<MarketingConsentState> {
  const channel = value(formData, "channel")
  if (!isMarketingChannel(channel)) {
    return { error: "We couldn't update that preference." }
  }

  const optedIn = formData.get("optedIn") === "on"

  try {
    await updateCustomerMarketingConsent({ channel, optedIn })
  } catch {
    return {
      channel,
      optedIn: !optedIn,
      error: "We couldn't save that preference. Try again.",
    }
  }

  revalidatePath(PROFILE_PATH)
  return { channel, optedIn }
}

export async function resendHomeProfileEmailAction(): Promise<ProfileEditState> {
  try {
    const customer = await getCurrentCustomer()
    if (!customer?.email || customer.emailVerifiedAt) {
      return { errors: { form: "There is no email awaiting confirmation." } }
    }
    await startCustomerEmailVerification(customer.email)
  } catch (error) {
    return {
      errors: {
        form:
          error instanceof RateLimitError
            ? "Please wait a minute before requesting another code."
            : "We couldn't email a new code. Try again.",
      },
    }
  }
  revalidatePath(PROFILE_PATH)
  return { message: "We've emailed you a new code." }
}

export async function clearHomeProfileEmailAction(): Promise<void> {
  const result = await clearCustomerEmail()
  await clearPendingEmailVerification()
  if (!result.cleared) {
    revalidatePath(PROFILE_PATH)
    return
  }
  revalidatePath(PROFILE_PATH)
}

export type PhoneMessagingState = {
  readonly error?: string
  readonly message?: string
}

export async function updateHomePhoneMessagingAction(
  _state: PhoneMessagingState,
  formData: FormData
): Promise<PhoneMessagingState> {
  const customer = await getCurrentCustomer()
  if (!customer) return { error: "Sign in to change your phone messages." }

  const preferredPhoneChannel = value(formData, "preferredPhoneChannel")
  const phoneMessages = formData.get("phoneMessagesEnabled")
  if (
    (preferredPhoneChannel !== "whatsapp" && preferredPhoneChannel !== "sms") ||
    (phoneMessages !== null && phoneMessages !== "on")
  ) {
    return { error: "Choose WhatsApp or text for your phone messages." }
  }

  try {
    const supabase = createSupabaseServiceRoleClient()
    const { error } = await supabase.rpc(
      "update_customer_phone_messaging_preferences",
      {
        p_customer_id: customer.id,
        p_phone_messages_enabled: phoneMessages === "on",
        p_preferred_phone_channel: preferredPhoneChannel,
      }
    )
    if (error)
      return { error: "We couldn't save your phone preferences. Try again." }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return {
      error:
        "We couldn't confirm your phone preferences. Reload to check them.",
    }
  }

  revalidatePath(PROFILE_PATH)
  return { message: "Your phone preferences are saved." }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}
