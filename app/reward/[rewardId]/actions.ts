"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

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
import {
  redeemSelfServiceReward,
  type GeoCoordinates,
} from "@/lib/customer/stamp"

export type SelfRedeemActionState = {
  errors?: {
    form?: string
  }
}

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
}

export async function selfRedeemAction(
  _state: SelfRedeemActionState,
  formData: FormData
): Promise<SelfRedeemActionState> {
  const rewardId = value(formData, "rewardId")

  if (!rewardId) {
    return { errors: { form: "Reward unavailable." } }
  }

  const result = await redeemSelfServiceReward(rewardId, coordinates(formData))

  if (result.status === "blocked") {
    return { errors: { form: result.reason } }
  }

  revalidatePath(`/card/${result.membershipId}`)
  revalidatePath(`/reward/${rewardId}`)
  // Land on a reward-specific proof URL — unambiguous when a membership has more
  // than one reward, and the proof screen links back to the card.
  redirect(`/reward/${rewardId}?redeemed=1`)
}

/**
 * Step one of the redeem-time profile gate: capture Name + DOB (and an optional
 * email). When an email is entered, kick off email verification and let the
 * re-rendered reward panel show the "enter your code" step.
 */
export async function saveProfileForRedeemAction(
  _state: ProfileGateActionState,
  formData: FormData
): Promise<ProfileGateActionState> {
  const rewardId = value(formData, "rewardId")
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
  }

  if (rewardId) revalidatePath(`/reward/${rewardId}`)
  return { fields }
}

/** Step two: confirm the emailed code, marking the email verified so the gate clears. */
export async function verifyProfileEmailAction(
  _state: ProfileGateActionState,
  formData: FormData
): Promise<ProfileGateActionState> {
  const rewardId = value(formData, "rewardId")
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

  if (rewardId) revalidatePath(`/reward/${rewardId}`)
  return {}
}

/** Re-sends the emailed code to the address already on the (unverified) profile. */
export async function resendProfileEmailAction(formData: FormData): Promise<void> {
  const rewardId = value(formData, "rewardId")
  const customer = await getCurrentCustomer()

  if (customer?.email) {
    await startCustomerEmailVerification(customer.email)
  }

  if (rewardId) revalidatePath(`/reward/${rewardId}`)
}

/** "Continue without email" — drops the entered email so the gate clears on Name + DOB. */
export async function clearProfileEmailAction(formData: FormData): Promise<void> {
  const rewardId = value(formData, "rewardId")
  await clearCustomerEmail()
  await clearPendingEmailVerification()

  if (rewardId) revalidatePath(`/reward/${rewardId}`)
}

function coordinates(formData: FormData): GeoCoordinates | undefined {
  const latitude = numberValue(formData, "latitude")
  const longitude = numberValue(formData, "longitude")

  if (latitude === null || longitude === null) return undefined

  return { latitude, longitude }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  if (typeof raw !== "string") return ""

  return raw.trim()
}

function numberValue(formData: FormData, key: string) {
  const raw = value(formData, key)
  if (!raw) return null

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}
