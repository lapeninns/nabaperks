import { createHmac, randomUUID } from "node:crypto"

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
  if (!process.env.SUPABASE_JWT_SECRET?.trim()) {
    return "SUPABASE_JWT_SECRET is required"
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
    await assertLegacyPasswordJwtDeniedAtDataApi(url)

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

async function assertLegacyPasswordJwtDeniedAtDataApi(
  url: string
): Promise<void> {
  const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const passwordJwt = signLocalDataApiJwt("password")
  const otpJwt = signLocalDataApiJwt("otp")

  const passwordRead = await fetch(
    `${url}/rest/v1/merchants?select=id&limit=0`,
    {
      headers: dataApiHeaders(anonKey, passwordJwt),
    }
  )
  expect(passwordRead.status).toBe(403)
  expect(await passwordRead.text()).toMatch(
    /passwordless authentication session is required/i
  )

  const passwordWrite = await fetch(`${url}/rest/v1/rpc/save_loyalty_card`, {
    method: "POST",
    headers: dataApiHeaders(anonKey, passwordJwt),
    body: JSON.stringify({
      p_merchant_id: randomUUID(),
      p_card_id: null,
      p_card_name: "Rejected legacy session",
      p_stamps_required: 10,
      p_reward_name: "Rejected legacy reward",
      p_reward_terms: "",
      p_is_active: false,
      p_reward_expires_after_days: 30,
    }),
  })
  expect(passwordWrite.status).toBe(403)
  expect(await passwordWrite.text()).toMatch(
    /passwordless authentication session is required/i
  )

  const otpRead = await fetch(`${url}/rest/v1/merchants?select=id&limit=0`, {
    headers: dataApiHeaders(anonKey, otpJwt),
  })
  expect(otpRead.status).toBe(200)

  const otpWrite = await fetch(`${url}/rest/v1/rpc/save_loyalty_card`, {
    method: "POST",
    headers: dataApiHeaders(anonKey, otpJwt),
    body: JSON.stringify({
      p_merchant_id: randomUUID(),
      p_card_id: null,
      p_card_name: "OTP boundary proof",
      p_stamps_required: 10,
      p_reward_name: "OTP boundary reward",
      p_reward_terms: "",
      p_is_active: false,
      p_reward_expires_after_days: 30,
    }),
  })
  expect(otpWrite.status).toBe(403)
  expect(await otpWrite.text()).toMatch(/merchant ownership required/i)
}

function signLocalDataApiJwt(method: "otp" | "password"): string {
  const now = Math.floor(Date.now() / 1000)
  const header = encodeJwtPart({ alg: "HS256", typ: "JWT" })
  const payload = encodeJwtPart({
    aud: "authenticated",
    exp: now + 3600,
    iat: now,
    role: "authenticated",
    sub: randomUUID(),
    amr: [{ method, timestamp: now }],
  })
  const unsigned = `${header}.${payload}`
  const signature = createHmac("sha256", requiredEnv("SUPABASE_JWT_SECRET"))
    .update(unsigned)
    .digest("base64url")
  return `${unsigned}.${signature}`
}

function encodeJwtPart(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function dataApiHeaders(anonKey: string, jwt: string) {
  return {
    apikey: anonKey,
    authorization: `Bearer ${jwt}`,
    "content-type": "application/json",
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
