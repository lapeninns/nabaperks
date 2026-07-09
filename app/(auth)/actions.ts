"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  finalizeMerchantEmailOtpAlias,
  merchantEmailOtpAliasDigitLabel,
  merchantEmailOtpAliasLength,
  releaseMerchantEmailOtpAlias,
  reserveMerchantEmailOtpAlias,
  type MerchantEmailOtpPurpose,
} from "@/lib/auth/merchant-email-otp-alias"
import { runMerchantOtpProviderVerification } from "@/lib/auth/merchant-email-otp-provider"
import { merchantSignupVerifyHref } from "@/lib/navigation/merchant-auth-hrefs"
import { safeMerchantNextPath } from "@/lib/navigation/safe-next-path"
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitIdentityFromHeaders,
} from "@/lib/security/rate-limit"
import { validateConfirmPassword, validatePassword } from "@/lib/auth/password"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type AuthActionState = {
  fields?: {
    name?: string
    email?: string
    otpSent?: boolean
    /** Sign-in hit an unverified email — the form offers a fresh-code path. */
    needsVerification?: boolean
  }
  errors?: {
    name?: string
    email?: string
    password?: string
    confirmPassword?: string
    otp?: string
    form?: string
  }
  message?: string
}

type AuthMode = "sign-in" | "sign-up"

type AuthRateLimitScope =
  | "merchant-signup"
  | "merchant-signin"
  | "merchant-verify"
  | "merchant-reset"

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

// Passwords are used verbatim; never trim (leading/trailing characters count).
function passwordValue(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw : ""
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function otpPattern() {
  return new RegExp(`^\\d{${merchantEmailOtpAliasLength()}}$`)
}

export async function signUpAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const name = value(formData, "name")
  const email = value(formData, "email").toLowerCase()
  const next = value(formData, "next") || defaultNextPath("sign-up")
  const errors: NonNullable<AuthActionState["errors"]> = {}

  const password = passwordValue(formData, "password")
  const confirmPassword = passwordValue(formData, "confirmPassword")

  if (name.length < 2) errors.name = "Enter your name."
  if (!validateEmail(email)) errors.email = "Enter a valid email address."
  const passwordError = validatePassword(password)
  if (passwordError) errors.password = passwordError
  else {
    const confirmError = validateConfirmPassword(password, confirmPassword)
    if (confirmError) errors.confirmPassword = confirmError
  }

  if (Object.keys(errors).length) {
    return { fields: { name, email }, errors }
  }

  const rateLimitResult = await enforceAuthRateLimit("merchant-signup", email)
  if (rateLimitResult)
    return { fields: { name, email }, errors: rateLimitResult }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  })

  if (error) {
    // House copy only — raw provider messages never reach merchants.
    return {
      fields: { name, email },
      errors: {
        form: "Could not create the account just now. Check your details and try again.",
      },
    }
  }

  // With email confirmations on, Supabase returns a user with no identities
  // when the email already belongs to a confirmed account.
  if (data.user && data.user.identities?.length === 0) {
    return {
      fields: { name, email },
      errors: {
        form: "That email already has a venue account. Log in or reset your password instead.",
      },
    }
  }

  redirect(
    merchantSignupVerifyHref({
      email,
      name,
      next: safeMerchantNextPath(next, defaultNextPath("sign-up")),
    })
  )
}

export async function resendSignupOtpAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const name = value(formData, "name")
  const email = value(formData, "email").toLowerCase()
  const errors: NonNullable<AuthActionState["errors"]> = {}

  if (!validateEmail(email)) errors.email = "Enter a valid email address."

  if (Object.keys(errors).length) {
    return { fields: { name, email }, errors }
  }

  const rateLimitResult = await enforceAuthRateLimit("merchant-signup", email)
  if (rateLimitResult) {
    return { fields: { name, email }, errors: rateLimitResult }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  })

  if (error) {
    // House copy only — raw provider messages never reach merchants
    // (matches the login page's "Provider details are hidden for safety").
    return {
      fields: { name, email },
      errors: {
        form: "Could not send another code just now. Wait a moment and try again.",
      },
    }
  }

  return {
    fields: { name, email },
    message: `We sent another ${merchantEmailOtpAliasDigitLabel()} code. Enter it below.`,
  }
}

export async function signInAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = value(formData, "email").toLowerCase()
  const password = passwordValue(formData, "password")
  const next = value(formData, "next") || defaultNextPath("sign-in")
  const errors: NonNullable<AuthActionState["errors"]> = {}

  if (!validateEmail(email)) errors.email = "Enter a valid email address."
  if (!password) errors.password = "Enter your password."

  if (Object.keys(errors).length) {
    return { fields: { email }, errors }
  }

  const rateLimitResult = await enforceAuthRateLimit("merchant-signin", email)
  if (rateLimitResult) return { fields: { email }, errors: rateLimitResult }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.code === "email_not_confirmed") {
      // needsVerification lets the form render a direct fresh-code link
      // (prefilled signup) instead of sending the merchant back through the
      // whole signup form by hand.
      return {
        fields: { email, needsVerification: true },
        errors: {
          form: "Verify your email first — get a fresh code and finish verification.",
        },
      }
    }

    return {
      fields: { email },
      errors: { form: "That email or password is not right." },
    }
  }

  redirect(safeMerchantNextPath(next))
}

export async function verifyEmailOtpAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const name = value(formData, "name")
  const email = value(formData, "email").toLowerCase()
  const otp = value(formData, "otp").replace(/\s+/g, "")
  const next = value(formData, "next") || defaultNextPath("sign-up")
  const fields = { name, email }
  const errors: NonNullable<AuthActionState["errors"]> = {}

  if (!validateEmail(email)) errors.form = "Request a fresh email code."
  if (!otpPattern().test(otp)) {
    errors.otp = `Enter the ${merchantEmailOtpAliasDigitLabel()} code from your email.`
  }

  if (Object.keys(errors).length) {
    return { fields, errors }
  }

  const rateLimitResult = await enforceAuthRateLimit("merchant-verify", email)
  if (rateLimitResult) return { fields, errors: rateLimitResult }

  const supabase = await createSupabaseServerClient()
  const verification = await verifyMerchantEmailOtpAlias({
    aliasCode: otp,
    email,
    purpose: "signup",
    supabase,
    type: "signup",
  })

  if (verification.status === "error") {
    return {
      fields,
      errors: { form: verification.message },
    }
  }

  redirect(safeMerchantNextPath(next))
}

export async function requestPasswordResetAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = value(formData, "email").toLowerCase()
  const errors: NonNullable<AuthActionState["errors"]> = {}

  if (!validateEmail(email)) errors.email = "Enter a valid email address."

  if (Object.keys(errors).length) {
    return { fields: { email }, errors }
  }

  const rateLimitResult = await enforceAuthRateLimit("merchant-reset", email)
  if (rateLimitResult) return { fields: { email }, errors: rateLimitResult }

  const supabase = await createSupabaseServerClient()
  // Ignore the result so the response never reveals whether the email exists.
  const { error } = await supabase.auth.resetPasswordForEmail(email)

  if (error) {
    return {
      fields: { email },
      errors: {
        form: "Could not send a reset code just now. Wait a moment and try again.",
      },
    }
  }

  return {
    fields: { email, otpSent: true },
    message: `If that email has a venue account, we sent a ${merchantEmailOtpAliasDigitLabel()} reset code.`,
  }
}

export async function confirmPasswordResetAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = value(formData, "email").toLowerCase()
  const otp = value(formData, "otp").replace(/\s+/g, "")
  const password = passwordValue(formData, "password")
  const confirmPassword = passwordValue(formData, "confirmPassword")
  const fields = { email, otpSent: true }
  const errors: NonNullable<AuthActionState["errors"]> = {}

  if (!validateEmail(email)) errors.form = "Request a fresh reset code."
  if (!otpPattern().test(otp)) {
    errors.otp = `Enter the ${merchantEmailOtpAliasDigitLabel()} code from your email.`
  }
  const passwordError = validatePassword(password)
  if (passwordError) errors.password = passwordError
  else {
    const confirmError = validateConfirmPassword(password, confirmPassword)
    if (confirmError) errors.confirmPassword = confirmError
  }

  if (Object.keys(errors).length) {
    return { fields, errors }
  }

  const rateLimitResult = await enforceAuthRateLimit("merchant-verify", email)
  if (rateLimitResult) return { fields, errors: rateLimitResult }

  const supabase = await createSupabaseServerClient()
  const verification = await verifyMerchantEmailOtpAlias({
    aliasCode: otp,
    email,
    purpose: "recovery",
    supabase,
    type: "recovery",
  })

  if (verification.status === "error") {
    return {
      fields,
      errors: { form: verification.message },
    }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })

  if (updateError) {
    return {
      fields,
      errors: {
        form: "Your email was verified, but we could not save that password. Request a fresh reset code and try again.",
      },
    }
  }

  redirect(safeMerchantNextPath("/app"))
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}

type MerchantOtpVerificationResult =
  | { status: "verified" }
  | { status: "error"; message: string }

async function verifyMerchantEmailOtpAlias({
  aliasCode,
  email,
  purpose,
  supabase,
  type,
}: {
  aliasCode: string
  email: string
  purpose: MerchantEmailOtpPurpose
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  type: "recovery" | "signup"
}): Promise<MerchantOtpVerificationResult> {
  let reservation: Awaited<ReturnType<typeof reserveMerchantEmailOtpAlias>>

  try {
    reservation = await reserveMerchantEmailOtpAlias({
      aliasCode,
      email,
      purpose,
    })
  } catch (error) {
    console.error("Merchant email alias reservation failed", {
      error: safeServerErrorMessage(error),
      purpose,
    })
    return {
      status: "error",
      message:
        "We could not check your code just now. Your code has not been used — try again.",
    }
  }

  if (reservation.status !== "reserved") {
    return {
      status: "error",
      message: merchantOtpReservationMessage(reservation.status),
    }
  }

  const providerOutcome = await runMerchantOtpProviderVerification({
    finalize: (outcome) =>
      finalizeMerchantEmailOtpAlias({
        outcome,
        reservationId: reservation.reservationId,
      }),
    onCleanupError: (stage, error) => {
      console.error("Merchant email alias cleanup failed", {
        error: error.message,
        purpose,
        stage,
      })
    },
    release: () =>
      releaseMerchantEmailOtpAlias({
        reservationId: reservation.reservationId,
      }),
    verify: () =>
      supabase.auth.verifyOtp({
        email,
        token: reservation.supabaseToken,
        type,
      }),
  })

  switch (providerOutcome) {
    case "verified":
      return { status: "verified" }
    case "retryable":
      return {
        status: "error",
        message:
          "We could not check your code just now. Your code is still safe to retry.",
      }
    case "expired":
      return {
        status: "error",
        message: "That code has expired. Send a fresh code to continue.",
      }
    case "rejected":
      return {
        status: "error",
        message:
          "That code does not match. Check all six digits and try again.",
      }
  }
}

function merchantOtpReservationMessage(
  status: Exclude<
    Awaited<ReturnType<typeof reserveMerchantEmailOtpAlias>>["status"],
    "reserved"
  >
) {
  switch (status) {
    case "expired":
      return "That code has expired. Send a fresh code to continue."
    case "superseded":
      return "That code is from an earlier email. Use the latest code we sent."
    case "used":
      return "That code has already been used. Log in or send a fresh code."
    case "busy":
      return "That code is already being checked. Wait a moment and try again."
    case "throttled":
      return "Too many code checks. Wait a moment and try again."
    case "invalid":
    case "rejected":
      return "That code does not match. Check all six digits and try again."
  }
}

function safeServerErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown server error"
}

async function enforceAuthRateLimit(
  scope: AuthRateLimitScope,
  email: string
): Promise<NonNullable<AuthActionState["errors"]> | null> {
  const requestHeaders = await headers()
  const requestIdentity = rateLimitIdentityFromHeaders(requestHeaders)

  try {
    await enforceRateLimit({
      key: `${scope}:${email}:${requestIdentity}`,
      limit: scope === "merchant-signup" ? 3 : 5,
      windowMs: 15 * 60_000,
    })
    return null
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { form: rateLimitMessage(scope) }
    }

    throw error
  }
}

function defaultNextPath(mode: AuthMode): string {
  return mode === "sign-up" ? "/app/onboarding" : "/app"
}

function rateLimitMessage(scope: AuthRateLimitScope): string {
  switch (scope) {
    case "merchant-signup":
      return "Too many sign-up attempts. Try again later."
    case "merchant-signin":
      return "Too many sign-in attempts. Try again later."
    case "merchant-verify":
      return "Too many code checks. Try again later."
    case "merchant-reset":
      return "Too many reset attempts. Try again later."
  }
}
