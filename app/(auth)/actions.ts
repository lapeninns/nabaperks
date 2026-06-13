"use server"

import { redirect } from "next/navigation"

import { getServerEnv } from "@/lib/env/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type AuthActionState = {
  fields?: {
    name?: string
    email?: string
  }
  errors?: {
    name?: string
    email?: string
    password?: string
    form?: string
  }
  message?: string
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function safeNextPath(next: string) {
  const appOrigin = "https://nabaperks.local"

  try {
    const url = new URL(next, appOrigin)

    if (url.origin !== appOrigin) {
      return "/app"
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return "/app"
  }
}

export async function signUpAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const name = value(formData, "name")
  const email = value(formData, "email").toLowerCase()
  const password = value(formData, "password")
  const errors: NonNullable<AuthActionState["errors"]> = {}

  if (name.length < 2) errors.name = "Enter your name."
  if (!validateEmail(email)) errors.email = "Enter a valid email address."
  if (password.length < 8) {
    errors.password = "Use at least 8 characters."
  }

  if (Object.keys(errors).length) {
    return { fields: { name, email }, errors }
  }

  const supabase = await createSupabaseServerClient()
  const env = getServerEnv()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/app/onboarding`,
    },
  })

  if (error) {
    return {
      fields: { name, email },
      errors: { form: error.message },
    }
  }

  if (data.session) {
    redirect("/app/onboarding")
  }

  return {
    fields: { name, email },
    message: "Check your email to verify your account, then continue setup.",
  }
}

export async function signInAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = value(formData, "email").toLowerCase()
  const password = value(formData, "password")
  const next = value(formData, "next") || "/app"
  const errors: NonNullable<AuthActionState["errors"]> = {}

  if (!validateEmail(email)) errors.email = "Enter a valid email address."
  if (!password) errors.password = "Enter your password."

  if (Object.keys(errors).length) {
    return { fields: { email }, errors }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return {
      fields: { email },
      errors: { form: "Email or password was not accepted." },
    }
  }

  redirect(safeNextPath(next))
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}
