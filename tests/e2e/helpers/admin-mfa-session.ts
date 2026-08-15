import { createHmac } from "node:crypto"

import { createServerClient } from "@supabase/ssr"
import type { BrowserContext } from "@playwright/test"

import { cleanupScope, runCleanupSteps } from "./cleanup-lifecycle.ts"

const ADMIN_EMAIL = "admin@nabaperks.test"
const ADMIN_PASSWORD = "NabaperksDemo1!"
const BROWSER_COOKIE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"

type BrowserCookie = Parameters<BrowserContext["addCookies"]>[0][number]

type RequiredEnvName =
  "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"

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

type SupabaseResult<T> = {
  readonly data: T | null
  readonly error: { readonly message: string } | null
}

type TotpEnrollment = {
  readonly id: string
  readonly totp?: {
    readonly qr_code?: string
    readonly secret?: string
  }
}

type MfaChallenge = {
  readonly id: string
}

type AssuranceLevel = {
  readonly currentLevel: string | null
}

type MfaFactors = {
  readonly all: readonly { readonly id: string }[]
}

export type AdminMfaLifecycleOptions = {
  readonly afterEnrollment?: () => Promise<void>
}

export type AdminMfaCleanup = () => Promise<void>

export async function installSeededAdminAal2Session(
  context: BrowserContext,
  options: AdminMfaLifecycleOptions = {}
): Promise<AdminMfaCleanup> {
  const session = await createSeededAdminAal2Session(options)
  try {
    await context.addCookies(session.cookies)
    return session.cleanup
  } catch (cookieError) {
    try {
      await session.cleanup()
    } catch (cleanupError) {
      throw new AggregateError(
        [cookieError, cleanupError],
        "Admin browser session setup failed and factor cleanup was incomplete."
      )
    }
    throw cookieError
  }
}

async function createSeededAdminAal2Session(
  options: AdminMfaLifecycleOptions
): Promise<{
  readonly cookies: readonly BrowserCookie[]
  readonly cleanup: AdminMfaCleanup
}> {
  const cookieJar = new Map<string, StoredCookie>()
  const supabase = createServerClient(
    requireLocalSupabaseUrl(requiredEnv("NEXT_PUBLIC_SUPABASE_URL")),
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

  const signIn = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })
  if (signIn.error) {
    throw new Error(`seeded admin sign-in: ${signIn.error.message}`)
  }
  if (!signIn.data.user || !signIn.data.session) {
    throw new Error("seeded admin sign-in: missing user or session data.")
  }
  const enrollment = requireData<TotpEnrollment>(
    "seeded admin TOTP enroll",
    await supabase.auth.mfa.enroll({ factorType: "totp" })
  )
  const scope = cleanupScope(`admin-mfa-${enrollment.id}`)
  const cleanup = async (): Promise<void> =>
    runCleanupSteps(
      scope,
      [
        {
          label: "seeded admin TOTP cleanup readback",
          run: async () => {
            const factors = requireData<MfaFactors>(
              "seeded admin TOTP cleanup readback",
              await supabase.auth.mfa.listFactors()
            )
            if (factors.all.some((factor) => factor.id === enrollment.id)) {
              throw new Error(
                "Seeded admin TOTP cleanup left the enrolled factor."
              )
            }
          },
          scope,
        },
        {
          label: "seeded admin TOTP cleanup",
          run: async () => {
            requireData(
              "seeded admin TOTP cleanup",
              await supabase.auth.mfa.unenroll({ factorId: enrollment.id })
            )
          },
          scope,
        },
      ],
      "Seeded admin TOTP cleanup failed."
    )

  try {
    await options.afterEnrollment?.()
    const challenge = requireData<MfaChallenge>(
      "seeded admin TOTP challenge",
      await supabase.auth.mfa.challenge({ factorId: enrollment.id })
    )

    requireData(
      "seeded admin TOTP verify",
      await supabase.auth.mfa.verify({
        factorId: enrollment.id,
        challengeId: challenge.id,
        code: totpCode(totpSecret(enrollment)),
      })
    )

    const assurance = requireData<AssuranceLevel>(
      "seeded admin MFA assurance",
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    )
    if (assurance.currentLevel !== "aal2") {
      throw new Error(
        `Seeded admin MFA verification did not produce aal2; got ${assurance.currentLevel}.`
      )
    }

    return {
      cookies: Array.from(cookieJar, ([name, cookie]) =>
        browserCookie(name, cookie)
      ),
      cleanup,
    }
  } catch (setupError) {
    try {
      await cleanup()
    } catch (cleanupError) {
      throw new AggregateError(
        [setupError, cleanupError],
        "Seeded admin MFA setup failed and factor cleanup was incomplete."
      )
    }
    throw setupError
  }
}

export function requireLocalSupabaseUrl(rawUrl: string): string {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must point at local Supabase.")
  }
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.port === "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must point at local Supabase.")
  }
  return url.href
}

function requiredEnv(name: RequiredEnvName): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required for seeded admin MFA E2E.`)
  }
  return value
}

function requireData<T>(label: string, result: SupabaseResult<T>): T {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`)
  }
  if (!result.data) {
    throw new Error(`${label}: missing response data.`)
  }
  return result.data
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

function totpSecret(enrollment: TotpEnrollment): string {
  const directSecret = enrollment.totp?.secret?.trim()
  if (directSecret) return directSecret

  const qrCode = enrollment.totp?.qr_code
  if (!qrCode) {
    throw new Error("Seeded admin TOTP enrollment did not include a QR code.")
  }

  const match = /[?&]secret=([^&]+)/.exec(qrCode)
  const encodedSecret = match?.at(1)
  if (!encodedSecret) {
    throw new Error("Seeded admin TOTP QR code did not include a secret.")
  }
  return decodeURIComponent(encodedSecret)
}

function totpCode(secret: string, now: number = Date.now()): string {
  const counter = Math.floor(now / 30_000)
  const message = Buffer.alloc(8)
  message.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0)
  message.writeUInt32BE(counter % 0x1_0000_0000, 4)

  const digest = createHmac("sha1", decodeBase32(secret))
    .update(message)
    .digest()
  const offset = byteAt(digest, digest.length - 1) & 0xf
  const binary =
    ((byteAt(digest, offset) & 0x7f) << 24) |
    ((byteAt(digest, offset + 1) & 0xff) << 16) |
    ((byteAt(digest, offset + 2) & 0xff) << 8) |
    (byteAt(digest, offset + 3) & 0xff)

  return String(binary % 1_000_000).padStart(6, "0")
}

function decodeBase32(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "")
  let bits = ""

  for (const char of clean) {
    const value = alphabet.indexOf(char)
    if (value < 0) {
      throw new Error("Seeded admin TOTP secret is not valid base32.")
    }
    bits += value.toString(2).padStart(5, "0")
  }

  const bytes: number[] = []
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
  }
  return Buffer.from(bytes)
}

function byteAt(buffer: Buffer, index: number): number {
  const value = buffer.at(index)
  if (value === undefined) {
    throw new Error("Seeded admin TOTP digest was shorter than expected.")
  }
  return value
}

function assertNeverSameSite(value: never): never {
  throw new Error(`Unexpected SameSite value: ${String(value)}`)
}
