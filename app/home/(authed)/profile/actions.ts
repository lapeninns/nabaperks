"use server"

import { revalidatePath } from "next/cache"

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
    return { fields, errors: { form: "We couldn't save your details. Try again." } }
  }

  if (emailVerificationRequired && savedEmail) {
    try {
      await startCustomerEmailVerification(savedEmail)
    } catch {
      return {
        fields,
        errors: { email: "We couldn't email a code to that address. Try again." },
      }
    }
    revalidatePath(PROFILE_PATH)
    return { fields, message: "Enter the code we sent to your email to confirm it." }
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
    return { errors: { otp: "That code didn't match. Check your email and try again." } }
  }

  try {
    await markCustomerEmailVerified(result.email)
  } catch {
    return { errors: { form: "We couldn't confirm your email. Try again." } }
  }

  revalidatePath(PROFILE_PATH)
  return { message: "Your email is confirmed." }
}

export async function resendHomeProfileEmailAction(): Promise<void> {
  const customer = await getCurrentCustomer()
  if (customer?.email) await startCustomerEmailVerification(customer.email)
  revalidatePath(PROFILE_PATH)
}

export async function clearHomeProfileEmailAction(): Promise<void> {
  await clearCustomerEmail()
  await clearPendingEmailVerification()
  revalidatePath(PROFILE_PATH)
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}
