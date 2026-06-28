"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

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
  }
  errors?: {
    name?: string
    email?: string
    otp?: string
    form?: string
  }
  message?: string
}

type AuthMode = "sign-in" | "sign-up"

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function signUpAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const name = value(formData, "name")
  const email = value(formData, "email").toLowerCase()
  const errors: NonNullable<AuthActionState["errors"]> = {}

  if (name.length < 2) errors.name = "Enter your name."
  if (!validateEmail(email)) errors.email = "Enter a valid email address."

  if (Object.keys(errors).length) {
    return { fields: { name, email }, errors }
  }

  const rateLimitResult = await enforceAuthRateLimit("merchant-signup", email)
  if (rateLimitResult)
    return { fields: { name, email }, errors: rateLimitResult }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { name },
    },
  })

  if (error) {
    return {
      fields: { name, email },
      errors: { form: error.message },
    }
  }

  return {
    fields: { name, email, otpSent: true },
    message: "We sent a six-digit code. Enter it below to continue setup.",
  }
}

export async function signInAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = value(formData, "email").toLowerCase()
  const errors: NonNullable<AuthActionState["errors"]> = {}

  if (!validateEmail(email)) errors.email = "Enter a valid email address."

  if (Object.keys(errors).length) {
    return { fields: { email }, errors }
  }

  const rateLimitResult = await enforceAuthRateLimit("merchant-signin", email)
  if (rateLimitResult) return { fields: { email }, errors: rateLimitResult }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  })

  if (error) {
    return {
      fields: { email },
      errors: { form: "No venue account was found for that email." },
    }
  }

  return {
    fields: { email, otpSent: true },
    message: "We sent a six-digit code. Enter it below to open the console.",
  }
}

export async function verifyEmailOtpAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const name = value(formData, "name")
  const email = value(formData, "email").toLowerCase()
  const otp = value(formData, "otp").replace(/\s+/g, "")
  const mode = readAuthMode(value(formData, "mode"))
  const next = value(formData, "next") || defaultNextPath(mode)
  const fields = { name, email, otpSent: true }
  const errors: NonNullable<AuthActionState["errors"]> = {}

  if (!validateEmail(email)) errors.form = "Request a fresh email code."
  if (!/^\d{4,8}$/.test(otp)) {
    errors.otp = "Enter the code from your email."
  }

  if (Object.keys(errors).length) {
    return { fields, errors }
  }

  const rateLimitResult = await enforceAuthRateLimit("merchant-verify", email)
  if (rateLimitResult) return { fields, errors: rateLimitResult }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: "email",
  })

  if (error) {
    return {
      fields,
      errors: { form: "That code was not accepted. Check it and try again." },
    }
  }

  redirect(safeMerchantNextPath(next))
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}

async function enforceAuthRateLimit(
  scope: "merchant-signup" | "merchant-signin" | "merchant-verify",
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

function readAuthMode(raw: string): AuthMode {
  return raw === "sign-up" ? "sign-up" : "sign-in"
}

function defaultNextPath(mode: AuthMode): string {
  return mode === "sign-up" ? "/app/onboarding" : "/app"
}

function rateLimitMessage(
  scope: "merchant-signup" | "merchant-signin" | "merchant-verify"
): string {
  switch (scope) {
    case "merchant-signup":
      return "Too many sign-up attempts. Try again later."
    case "merchant-signin":
      return "Too many sign-in attempts. Try again later."
    case "merchant-verify":
      return "Too many code checks. Try again later."
  }
}
