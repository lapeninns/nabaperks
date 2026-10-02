import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import type { BrowserContext } from "@playwright/test"

import { signInWithGeneratedEmailOtp } from "./passwordless-auth-session"

const ADMIN_EMAIL = "admin@nabaperks.test"
const BROWSER_COOKIE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"

type BrowserCookie = Parameters<BrowserContext["addCookies"]>[0][number]

type RequiredEnvName =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"

type SupabaseCookieOptions = {
  readonly expires?: Date
  readonly httpOnly?: boolean
  readonly maxAge?: number
  readonly path?: string
  readonly sameSite?: boolean | "lax" | "strict" | "none"
  readonly secure?: boolean
}

type SupabaseCookie = {
  readonly name: string
  readonly value: string
  readonly options: SupabaseCookieOptions
}

type StoredCookie = {
  readonly value: string
  readonly options: SupabaseCookieOptions
}

export type AdminSessionCleanup = () => Promise<void>

export async function installSeededAdminSession(
  context: BrowserContext
): Promise<AdminSessionCleanup> {
  return installLocalEmailSession(context, ADMIN_EMAIL)
}

export async function installLocalEmailSession(
  context: BrowserContext,
  email: string
): Promise<AdminSessionCleanup> {
  const session = await createLocalEmailSession(email)
  await context.addCookies(session.cookies)
  return session.cleanup
}

async function createLocalEmailSession(email: string): Promise<{
  readonly cookies: readonly BrowserCookie[]
  readonly cleanup: AdminSessionCleanup
}> {
  const cookieJar = new Map<string, StoredCookie>()
  const supabaseUrl = requiredLocalSupabaseUrl()
  const supabase = createServerClient(
    supabaseUrl,
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return Array.from(cookieJar, ([name, cookie]) => ({
            name,
            value: cookie.value,
          }))
        },
        setAll(cookiesToSet: SupabaseCookie[]) {
          for (const cookie of cookiesToSet) {
            if (cookie.value) {
              cookieJar.set(cookie.name, {
                value: cookie.value,
                options: cookie.options,
              })
            } else {
              cookieJar.delete(cookie.name)
            }
          }
        },
      },
    }
  )

  const signIn = await signInWithGeneratedEmailOtp(
    supabase,
    localServiceClient(supabaseUrl),
    email
  )
  if (signIn.error) {
    throw new Error(`seeded admin sign-in: ${signIn.error.message}`)
  }
  if (!signIn.data.user || !signIn.data.session) {
    throw new Error("seeded admin sign-in: missing user or session data.")
  }
  return {
    cookies: Array.from(cookieJar, ([name, cookie]) =>
      browserCookie(name, cookie)
    ),
    cleanup: async () => {
      const { error } = await supabase.auth.signOut({ scope: "local" })
      if (error)
        throw new Error(`Local email session cleanup: ${error.message}`)
    },
  }
}

function requiredLocalSupabaseUrl(): string {
  const value = requiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  const parsed = new URL(value)
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(hostname)) {
    throw new Error("Email session E2E may target only local Supabase.")
  }
  return value
}

function localServiceClient(supabaseUrl: string) {
  return createClient(supabaseUrl, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  })
}

function requiredEnv(name: RequiredEnvName): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required for local email session E2E.`)
  }
  return value
}

function browserCookie(name: string, cookie: StoredCookie): BrowserCookie {
  const expires = cookieExpires(cookie.options)
  const sameSite = sameSiteOption(cookie.options.sameSite)

  return {
    name,
    value: cookie.value,
    url: BROWSER_COOKIE_URL,
    ...(expires !== undefined ? { expires } : {}),
    ...(typeof cookie.options.httpOnly === "boolean"
      ? { httpOnly: cookie.options.httpOnly }
      : {}),
    ...(typeof cookie.options.secure === "boolean"
      ? { secure: cookie.options.secure }
      : {}),
    ...(sameSite !== undefined ? { sameSite } : {}),
  }
}

function cookieExpires(options: SupabaseCookieOptions): number | undefined {
  if (options.expires instanceof Date) {
    return Math.floor(options.expires.getTime() / 1000)
  }
  if (typeof options.maxAge === "number") {
    return Math.floor(Date.now() / 1000) + options.maxAge
  }
  return undefined
}

function sameSiteOption(
  value: SupabaseCookieOptions["sameSite"]
): BrowserCookie["sameSite"] | undefined {
  switch (value) {
    case "lax":
      return "Lax"
    case "strict":
    case true:
      return "Strict"
    case "none":
      return "None"
    case false:
    case undefined:
      return undefined
    default:
      return assertNeverSameSite(value)
  }
}

function assertNeverSameSite(value: never): never {
  throw new Error(`Unexpected SameSite value: ${String(value)}`)
}
