"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  consumeMerchantEmailOtpAlias,
  merchantEmailOtpAliasDigitLabel,
  merchantEmailOtpAliasLength,
} from "@/lib/auth/merchant-email-otp-alias"
import { safeMerchantNextPath } from "@/lib/navigation/safe-next-path"
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitIdentityFromHeaders,
} from "@/lib/security/rate-limit"
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

// Mirrors supabase config: minimum_password_length = 8,
// password_requirements = "letters_digits".
function validatePassword(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters."
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "Use a mix of letters and numbers."
  }
  return null
}

function otpPattern() {
  return new RegExp(`^\\d{${merchantEmailOtpAliasLength()}}$`)
}

export async function signUpAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const intent = value(formData, "intent") || "create"
  const name = value(formData, "name")
  const email = value(formData, "email").toLowerCase()
  const errors: NonNullable<AuthActionState["errors"]> = {}

  if (intent === "resend") {
    if (!validateEmail(email)) errors.email = "Enter a valid email address."

    if (Object.keys(errors).length) {
      return { fields: { name, email, otpSent: true }, errors }
    }

    const rateLimitResult = await enforceAuthRateLimit("merchant-signup", email)
    if (rateLimitResult) {
      return { fields: { name, email, otpSent: true }, errors: rateLimitResult }
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
        fields: { name, email, otpSent: true },
        errors: {
          form: "Could not send another code just now. Wait a moment and try again.",
        },
      }
    }

    return {
      fields: { name, email, otpSent: true },
      message: `We sent another ${merchantEmailOtpAliasDigitLabel()} code. Enter it below.`,
    }
  }

  const password = passwordValue(formData, "password")
  const confirmPassword = passwordValue(formData, "confirmPassword")

  if (name.length < 2) errors.name = "Enter your name."
  if (!validateEmail(email)) errors.email = "Enter a valid email address."
  const passwordError = validatePassword(password)
  if (passwordError) errors.password = passwordError
  else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match."
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

  return {
    fields: { name, email, otpSent: true },
    message: `We sent a ${merchantEmailOtpAliasDigitLabel()} code. Enter it below to verify your email.`,
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
  const fields = { name, email, otpSent: true }
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
  const supabaseToken = await consumeMerchantEmailOtpAlias({
    email,
    aliasCode: otp,
  })

  if (!supabaseToken) {
    return {
      fields,
      errors: { form: "That code was not accepted. Check it and try again." },
    }
  }

  const { error } = await supabase.auth.verifyOtp({
    email,
    token: supabaseToken,
    type: "signup",
  })

  if (error) {
    return {
      fields,
      errors: { form: "That code was not accepted. Check it and try again." },
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
  await supabase.auth.resetPasswordForEmail(email)

  return {
    fields: { email, otpSent: true },
    message:
      `If that email has a venue account, we sent a ${merchantEmailOtpAliasDigitLabel()} reset code.`,
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
  else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match."
  }

  if (Object.keys(errors).length) {
    return { fields, errors }
  }

  const rateLimitResult = await enforceAuthRateLimit("merchant-verify", email)
  if (rateLimitResult) return { fields, errors: rateLimitResult }

  const supabase = await createSupabaseServerClient()
  const supabaseToken = await consumeMerchantEmailOtpAlias({
    email,
    aliasCode: otp,
  })

  if (!supabaseToken) {
    return {
      fields,
      errors: { form: "That code was not accepted. Check it and try again." },
    }
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token: supabaseToken,
    type: "recovery",
  })

  if (verifyError) {
    return {
      fields,
      errors: { form: "That code was not accepted. Check it and try again." },
    }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })

  if (updateError) {
    return {
      fields,
      errors: { form: "Could not set that password. Try again." },
    }
  }

  redirect(safeMerchantNextPath("/app"))
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
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
