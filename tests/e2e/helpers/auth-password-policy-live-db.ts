import { randomUUID } from "node:crypto"

import { createClient } from "@supabase/supabase-js"
import { expect } from "@playwright/test"

import { signInWithGeneratedEmailOtp } from "./passwordless-auth-session"

export const AUTH_PASSWORD_POLICY_USER_AGENT =
  "Nabaperks passwordless auth local proof"

export function authPasswordPolicyLiveDbSkipReason(): string | undefined {
  if (process.env.MERCHANT_PASSWORDLESS_LIVE_E2E !== "1") {
    return "set MERCHANT_PASSWORDLESS_LIVE_E2E=1 with local Supabase to run passwordless provider proof"
  }
  if (!isLocalUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    return "NEXT_PUBLIC_SUPABASE_URL must point at local Supabase"
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY is required"
  }
  return undefined
}

export async function assertPublicLocalPasswordlessAuth(): Promise<void> {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  if (!isLocalUrl(url)) {
    throw new Error(
      "Passwordless provider proof may target only local Supabase."
    )
  }

  const anon = createClient(url, requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const admin = createClient(url, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const email = `passwordless-proof-${randomUUID()}@example.test`
  const password = `Rejected-${randomUUID()}-9`
  let userId: string | undefined

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (created.error || !created.data.user) {
      throw new Error(
        `Local passwordless proof user creation failed: ${created.error?.message ?? "missing user"}`
      )
    }
    userId = created.data.user.id

    const passwordAttempt = await anon.auth.signInWithPassword({
      email,
      password,
    })
    expect(passwordAttempt.data.session).toBeNull()
    expect(passwordAttempt.error?.status).toBe(403)

    const emailOtpAttempt = await signInWithGeneratedEmailOtp(
      anon,
      admin,
      email
    )
    expect(emailOtpAttempt.error).toBeNull()
    expect(emailOtpAttempt.data.session).not.toBeNull()
    expect(emailOtpAttempt.data.user?.id).toBe(userId)
  } finally {
    if (userId) {
      const deleted = await admin.auth.admin.deleteUser(userId)
      if (deleted.error) {
        throw new Error(
          `Local passwordless proof cleanup failed: ${deleted.error.message}`
        )
      }
    }
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function isLocalUrl(value: string | undefined): boolean {
  if (!value) return false
  try {
    const host = new URL(value).hostname.toLowerCase()
    return host === "127.0.0.1" || host === "localhost" || host === "::1"
  } catch {
    return false
  }
}
