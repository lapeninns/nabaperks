import { createHash, randomUUID } from "node:crypto"

import {
  createClient,
  isAuthWeakPasswordError,
  type SupabaseClient,
} from "@supabase/supabase-js"
import { expect, type Page } from "@playwright/test"

import { rateLimitIdentityFromHeaders } from "../../../lib/security/rate-limit-core"
import {
  assertMerchantAuthBrowserSession,
  assertMerchantAuthVerifiedDbState,
  assertMerchantRecoveryPasswordUpdated,
  cleanupMerchantAuthAliasRows,
  cleanupMerchantAuthLiveDbFixture,
  connectMerchantAuthRecoveryDb,
  createMerchantRecoveryLiveDbFixture,
  merchantAuthRecoveryLiveDbSkipReason,
  startMerchantAuthLocalEmailHookSink,
  type MerchantAuthLiveDbFixture,
} from "./merchant-auth-recovery-live-db"

export const AUTH_PASSWORD_POLICY_USER_AGENT =
  "Nabaperks password policy local proof"

const LIVE_PROOF_IP = "127.0.0.43"
const ACCEPTED_SIGNUP_PASSWORD = "venue123"
const REJECTED_PASSWORDS = [
  { password: "pub123", reason: "length" },
  { password: "12345678", reason: "characters" },
  { password: "pubhouse", reason: "characters" },
] as const
const RATE_LIMIT_SCOPES = [
  "merchant-signup",
  "merchant-signin",
  "merchant-verify",
  "merchant-reset",
] as const
const RESEND_SCOPES = ["signup", "recovery"] as const

export function authPasswordPolicyLiveDbSkipReason(): string | undefined {
  return merchantAuthRecoveryLiveDbSkipReason()
}

export async function assertPublicLocalPasswordPolicy(
  page: Page
): Promise<void> {
  const sql = connectMerchantAuthRecoveryDb()
  if (!sql) {
    throw new Error("Local Supabase DB is required for password-policy proof.")
  }

  const runId = randomUUID().replaceAll("-", "").slice(0, 16)
  const acceptedEmail = `password-policy-accepted-${runId}@example.test`
  // Keep cleanup identities independent from rejected password inputs. The
  // rate-limit table intentionally stores SHA-256 bucket keys, not passwords;
  // separating these values also makes that boundary explicit to CodeQL.
  const rejectedEmails = [
    `password-policy-rejected-length-${runId}@example.test`,
    `password-policy-rejected-digits-${runId}@example.test`,
    `password-policy-rejected-letters-${runId}@example.test`,
  ] as const
  const allEmails = [acceptedEmail, ...rejectedEmails]
  const requestIdentity = rateLimitIdentityFromHeaders(
    new Headers({
      "user-agent": AUTH_PASSWORD_POLICY_USER_AGENT,
      "x-vercel-forwarded-for": LIVE_PROOF_IP,
    })
  )
  const anon = localClient(requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
  const admin = localClient(requiredEnv("SUPABASE_SERVICE_ROLE_KEY"))
  const hookSink = await startMerchantAuthLocalEmailHookSink({
    response: "success",
  })
  let recoveryFixture: MerchantAuthLiveDbFixture | undefined
  let proofError: Error | undefined

  try {
    await page.setExtraHTTPHeaders({
      "x-vercel-forwarded-for": LIVE_PROOF_IP,
    })
    await page.goto("/signup")
    await page.getByLabel("Your name").fill("Password policy proof")
    await page.getByLabel("Email").fill(acceptedEmail)
    await page
      .getByLabel("Password", { exact: true })
      .fill(ACCEPTED_SIGNUP_PASSWORD)
    await page.getByLabel("Confirm password").fill(ACCEPTED_SIGNUP_PASSWORD)
    await page.getByRole("button", { name: "Create account" }).click()

    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === "/signup/verify" &&
        url.searchParams.get("email") === acceptedEmail
      )
    })
    expect(hookSink.requestCount()).toBe(1)
    await expectAuthUserCount(sql, acceptedEmail, 1)

    for (const [index, candidate] of REJECTED_PASSWORDS.entries()) {
      const email = rejectedEmails[index]
      const hookRequestsBefore = hookSink.requestCount()
      const result = await anon.auth.signUp({
        email,
        password: candidate.password,
      })

      expect(result.data.user).toBeNull()
      expect(isAuthWeakPasswordError(result.error)).toBe(true)
      if (!isAuthWeakPasswordError(result.error)) {
        throw new Error("Local Auth did not return AuthWeakPasswordError.")
      }
      expect(result.error.code).toBe("weak_password")
      expect([400, 422]).toContain(result.error.status)
      expect(result.error.reasons).toEqual([candidate.reason])
      expect(hookSink.requestCount()).toBe(hookRequestsBefore)
      await expectAuthUserCount(sql, email, 0)
    }

    recoveryFixture = await createMerchantRecoveryLiveDbFixture(sql)
    const recoveryQuery = new URLSearchParams({
      stage: "verify",
      email: recoveryFixture.email,
      next: recoveryFixture.nextPath,
    })
    await page.goto(`/reset-password?${recoveryQuery}`)
    await page.getByLabel("Reset code").fill(recoveryFixture.aliasCode)
    await page
      .getByLabel("New password", { exact: true })
      .fill(recoveryFixture.replacementPassword)
    await page
      .getByLabel("Confirm password")
      .fill(recoveryFixture.replacementPassword)
    await page.getByRole("button", { name: "Set new password" }).click()

    await expect(page).toHaveURL(
      (url) => `${url.pathname}${url.search}` === recoveryFixture?.nextPath
    )
    await assertMerchantAuthBrowserSession(page, recoveryFixture)
    await assertMerchantAuthVerifiedDbState(sql, recoveryFixture)
    await assertMerchantRecoveryPasswordUpdated(recoveryFixture)
  } catch (error) {
    proofError = asError("local password-policy proof", error)
  }

  const cleanupErrors: Error[] = []
  try {
    await cleanupMerchantAuthLiveDbFixture(
      sql,
      recoveryFixture,
      requestIdentity
    )
  } catch (error) {
    cleanupErrors.push(asError("recovery fixture cleanup", error))
  }
  try {
    await cleanupEmails({
      admin,
      emails: allEmails,
      requestIdentity,
      sql,
    })
  } catch (error) {
    cleanupErrors.push(asError("signup policy fixture cleanup", error))
  }
  try {
    await hookSink.close()
  } catch (error) {
    cleanupErrors.push(asError("email-hook sink shutdown", error))
  }
  try {
    await sql.end({ timeout: 5 })
  } catch (error) {
    cleanupErrors.push(asError("local DB shutdown", error))
  }

  if (proofError || cleanupErrors.length > 0) {
    throw new AggregateError(
      [proofError, ...cleanupErrors].filter(
        (error): error is Error => error instanceof Error
      ),
      "Local password-policy proof or cleanup failed."
    )
  }
}

async function cleanupEmails({
  admin,
  emails,
  requestIdentity,
  sql,
}: {
  readonly admin: SupabaseClient
  readonly emails: readonly string[]
  readonly requestIdentity: string
  readonly sql: NonNullable<ReturnType<typeof connectMerchantAuthRecoveryDb>>
}) {
  const users = await sql<readonly { id: string }[]>`
    select id::text as id
    from auth.users
    where email = any(${emails}::text[])`

  for (const { id } of users) {
    const deleted = await admin.auth.admin.deleteUser(id)
    if (deleted.error) throw deleted.error
  }

  for (const email of emails) {
    await cleanupMerchantAuthAliasRows(sql, email)
    await cleanupRateLimitBuckets(sql, email, requestIdentity)
  }

  const remaining = await sql<readonly { count: number }[]>`
    select (
      (select count(*) from auth.users where email = any(${emails}::text[])) +
      (select count(*) from public.merchant_email_otp_aliases where email = any(${emails}::text[])) +
      (select count(*) from public.merchant_email_otp_alias_attempts where email = any(${emails}::text[]))
    )::int as count`
  expect(remaining.at(0)?.count ?? -1).toBe(0)
}

async function cleanupRateLimitBuckets(
  sql: NonNullable<ReturnType<typeof connectMerchantAuthRecoveryDb>>,
  email: string,
  requestIdentity: string
) {
  const normalizedEmail = email.trim().toLowerCase()
  const rawKeys = [
    ...RATE_LIMIT_SCOPES.map(
      (scope) => `${scope}:${normalizedEmail}:${requestIdentity}`
    ),
    ...RESEND_SCOPES.flatMap((purpose) => [
      `merchant-otp-resend:${purpose}:${normalizedEmail}:${requestIdentity}:cooldown`,
      `merchant-otp-resend:${purpose}:${normalizedEmail}:${requestIdentity}:window`,
    ]),
  ]

  for (const rawKey of rawKeys) {
    const bucketKey = createHash("sha256").update(rawKey).digest("hex")
    await sql`
      delete from public.rate_limit_buckets
      where bucket_key = ${bucketKey}`
  }
}

async function expectAuthUserCount(
  sql: NonNullable<ReturnType<typeof connectMerchantAuthRecoveryDb>>,
  email: string,
  expected: number
) {
  const rows = await sql<readonly { count: number }[]>`
    select count(*)::int as count
    from auth.users
    where email = ${email}`
  expect(rows.at(0)?.count ?? -1).toBe(expected)
}

function localClient(key: string) {
  return createClient(requiredLocalSupabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function requiredLocalSupabaseUrl() {
  const value = requiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  const url = new URL(value)
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !["http:", "https:"].includes(url.protocol)
  ) {
    throw new Error("Password-policy proof refuses non-local Supabase Auth.")
  }
  return value
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for password-policy proof.`)
  return value
}

function asError(context: string, error: unknown) {
  return error instanceof Error
    ? new Error(`${context}: ${error.message}`, { cause: error })
    : new Error(`${context}: unknown failure`)
}
