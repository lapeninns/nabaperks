"use server"

import { revalidatePath } from "next/cache"

import { recordCustomerContactEvent } from "@/lib/customer/contact-events"
import {
  confirmCustomerEmailCode,
  emailConfirmationErrors,
} from "@/lib/customer/email-confirmation"
import { startCustomerEmailVerification } from "@/lib/customer/email-verification"
import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  clearCustomerEmail,
  updateCustomerProfile,
} from "@/lib/customer/profile"
import { validateProfileFields } from "@/lib/customer/profile-fields"
import { clearPendingEmailVerification } from "@/lib/customer/session"

export type ProfileGateActionState = {
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
 * Step one of the redeem-time profile gate: capture Name + DOB and required email.
 * When a new/unverified email is entered, kick off email verification and let
 * the re-rendered reward panel show the "enter your code" step.
 */
export async function saveProfileForRedeemAction(
  _state: ProfileGateActionState,
  formData: FormData
): Promise<ProfileGateActionState> {
  const rewardId = value(formData, "rewardId")
  const fullName = value(formData, "fullName")
  const dateOfBirth = value(formData, "dateOfBirth")
  const submittedEmail = value(formData, "email")
  const currentCustomer = submittedEmail ? null : await getCurrentCustomer()
  const lockedVerifiedEmail =
    currentCustomer?.email && currentCustomer.emailVerifiedAt
      ? currentCustomer.email.trim()
      : ""
  const email = submittedEmail || lockedVerifiedEmail
  const fields = { fullName, dateOfBirth, email }

  const errors = validateProfileFields({ fullName, dateOfBirth, email })
  if (!email) errors.email = "Enter your email address."
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

  if (savedEmail && emailVerificationRequired) {
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
    const customer = await getCurrentCustomer()
    recordCustomerContactEvent({
      eventName: "customer_email_verification_started",
      customerId: customer?.id ?? null,
      metadata: { method: "email", surface: "reward_gate" },
    })
  }

  if (rewardId) revalidatePath(`/reward/${rewardId}`)
  return { fields }
}

/** Step two: confirm the emailed code for a new/unverified profile email. */
export async function verifyProfileEmailAction(
  _state: ProfileGateActionState,
  formData: FormData
): Promise<ProfileGateActionState> {
  const rewardId = value(formData, "rewardId")
  const code = value(formData, "otp")

  if (!code) return { errors: { otp: "Enter the code from your email." } }

  const confirmation = await confirmCustomerEmailCode(code, "reward_gate")
  const errors = emailConfirmationErrors(confirmation)
  if (errors) return { errors }

  if (rewardId) revalidatePath(`/reward/${rewardId}`)
  return {}
}

/** Re-sends the emailed code to the address already on the (unverified) profile. */
export async function resendProfileEmailAction(
  _state: ProfileGateActionState,
  formData: FormData
): Promise<ProfileGateActionState> {
  const rewardId = value(formData, "rewardId")
  const customer = await getCurrentCustomer()

  if (customer?.email) {
    try {
      await startCustomerEmailVerification(customer.email)
    } catch {
      return {
        errors: {
          form: "We couldn't email a code just now. Try again shortly.",
        },
      }
    }
  }

  if (rewardId) revalidatePath(`/reward/${rewardId}`)
  return { message: "Code sent. Check your email." }
}

/** Clears an unverified address so a different email can be entered. */
export async function clearProfileEmailAction(
  formData: FormData
): Promise<void> {
  const rewardId = value(formData, "rewardId")
  const result = await clearCustomerEmail()
  await clearPendingEmailVerification()

  if (!result.cleared && rewardId) {
    revalidatePath(`/reward/${rewardId}`)
    return
  }

  if (rewardId) revalidatePath(`/reward/${rewardId}`)
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  if (typeof raw !== "string") return ""

  return raw.trim()
}
