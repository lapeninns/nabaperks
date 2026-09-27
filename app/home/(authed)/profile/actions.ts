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
  isEmailPromptSurface,
  type EmailPromptSurface,
} from "@/lib/customer/contact-event-core"
import { recordCustomerContactEvent } from "@/lib/customer/contact-events"
import {
  confirmCustomerEmailCode,
  emailConfirmationErrors,
} from "@/lib/customer/email-confirmation"
import { startCustomerEmailVerification } from "@/lib/customer/email-verification"
import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  clearCustomerEmail,
  setCustomerEmailForVerification,
  updateCustomerProfile,
} from "@/lib/customer/profile"
import {
  isEmailAddress,
  validateProfileFields,
} from "@/lib/customer/profile-fields"
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
    await recordVerificationStarted("profile")
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

  const confirmation = await confirmCustomerEmailCode(code, "profile")
  const errors = emailConfirmationErrors(confirmation)
  if (errors) return { errors }

  revalidatePath(PROFILE_PATH)
  return { message: "Your email is confirmed." }
}

export type EmailPromptState = {
  readonly step: "email" | "code" | "verified"
  readonly email?: string
  readonly errors?: {
    readonly email?: string
    readonly otp?: string
    readonly form?: string
  }
  readonly message?: string
}

/**
 * The "add your email" prompt (home, and after a stamp). One action for both
 * steps so the prompt holds a single state: `intent=verify` confirms a code,
 * `intent=resend` re-sends a code to the address already on the code step, and
 * anything else saves the submitted email and sends a code.
 */
export async function emailPromptAction(
  state: EmailPromptState,
  formData: FormData
): Promise<EmailPromptState> {
  return value(formData, "intent") === "verify"
    ? verifyEmailPrompt(state, formData)
    : startEmailPrompt(state, formData)
}

/**
 * Step one: save only the email and send a code. Name and date of birth are
 * not asked for here. Only the submitted field counts: an emptied field is an
 * error, never a silent send to an address the guest just removed.
 */
async function startEmailPrompt(
  state: EmailPromptState,
  formData: FormData
): Promise<EmailPromptState> {
  const surface = promptSurface(formData)
  const email = value(formData, "email")
  if (!email || !isEmailAddress(email)) {
    return {
      step: "email",
      email,
      errors: { email: "Enter a valid email address." },
    }
  }

  let savedEmail: string
  try {
    const saved = await setCustomerEmailForVerification(email, surface)
    if (saved.status === "already_verified") {
      return { step: "verified", message: "Your email is already confirmed." }
    }
    savedEmail = saved.email
  } catch {
    return {
      step: "email",
      email,
      errors: { form: "We couldn't save your email. Try again." },
    }
  }

  try {
    await startCustomerEmailVerification(savedEmail)
  } catch (error) {
    // Stay on the code step only when the earlier code still stands: a re-send
    // to the pending address that the cooldown refused before any new code was
    // issued. A failed delivery withdraws the pending code, and a newly entered
    // address got no code, so both go back to the email step.
    const resendingPendingCode =
      error instanceof RateLimitError &&
      value(formData, "intent") === "resend" &&
      state.step === "code" &&
      state.email?.trim().toLowerCase() === savedEmail
    return {
      step: resendingPendingCode ? "code" : "email",
      email: savedEmail,
      errors: {
        form:
          error instanceof RateLimitError
            ? "Please wait a minute before requesting another code."
            : "We couldn't email a code to that address. Try again.",
      },
    }
  }

  await recordVerificationStarted(surface)
  return {
    step: "code",
    email: savedEmail,
    message: "Enter the code we sent to your email.",
  }
}

/** Step two of the prompt: confirm the emailed code. */
async function verifyEmailPrompt(
  state: EmailPromptState,
  formData: FormData
): Promise<EmailPromptState> {
  const surface = promptSurface(formData)
  const email = state.email
  const code = value(formData, "otp")
  if (!code) {
    return {
      step: "code",
      email,
      errors: { otp: "Enter the code from your email." },
    }
  }

  const confirmation = await confirmCustomerEmailCode(code, surface)
  const errors = emailConfirmationErrors(confirmation)
  if (errors) {
    // A conflict ends this address: go back to the email step so the guest can
    // use another one. Anything else keeps the code step for another try.
    return confirmation.status === "conflict"
      ? { step: "email", errors }
      : { step: "code", email, errors }
  }

  revalidatePath(PROFILE_PATH)
  return { step: "verified", message: "Your email is confirmed." }
}

function promptSurface(formData: FormData): EmailPromptSurface {
  const surface = value(formData, "surface")
  return isEmailPromptSurface(surface) ? surface : "home_prompt"
}

async function recordVerificationStarted(
  surface: "profile" | EmailPromptSurface
): Promise<void> {
  const customer = await getCurrentCustomer()
  recordCustomerContactEvent({
    eventName: "customer_email_verification_started",
    customerId: customer?.id ?? null,
    metadata: { method: "email", surface },
  })
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
