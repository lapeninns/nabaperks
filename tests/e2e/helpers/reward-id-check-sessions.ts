import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import type { BrowserContext } from "@playwright/test"

import { seedMerchantOwnerEmail, type Sql } from "./admin-live-db"
import { createBrowserCustomerSession } from "./customer-readback-live-db"
import { signInWithGeneratedEmailOtp } from "./passwordless-auth-session"

export async function installRewardCustomerSession(
  sql: Sql,
  context: BrowserContext,
  customerId: string,
  baseURL: string
) {
  const session = await createBrowserCustomerSession(sql, customerId)
  await context.addCookies([
    {
      name: session.cookieName,
      value: session.cookieValue,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: session.expiresAt,
    },
    {
      name: session.deviceCookieName,
      value: session.deviceCookieValue,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: session.expiresAt,
    },
  ])
}

/** Real local Auth OTP verification, without delivering a test email. */
export async function installRewardOwnerSession(
  sql: Sql,
  context: BrowserContext,
  baseURL: string
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  if (!["localhost", "127.0.0.1"].includes(new URL(supabaseUrl).hostname)) {
    throw new Error("ID-check browser proof requires local Supabase")
  }
  const email = await seedMerchantOwnerEmail(sql, "old-crown-girton")
  if (!email)
    throw new Error("Seed merchant is required for ID-check browser proof")
  const jar = new Map<string, string>()
  const auth = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
        setAll: (cookies) => {
          for (const cookie of cookies) jar.set(cookie.name, cookie.value)
        },
      },
    }
  )
  const service = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
  const signedIn = await signInWithGeneratedEmailOtp(auth, service, email)
  if (signedIn.error || !signedIn.data.session)
    throw new Error("Local merchant OTP sign-in failed")
  await context.addCookies(
    Array.from(jar, ([name, value]) => ({
      name,
      value,
      url: baseURL,
      sameSite: "Lax",
    }))
  )
}
