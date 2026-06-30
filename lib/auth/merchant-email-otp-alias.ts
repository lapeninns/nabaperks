import "server-only"

import { randomInt } from "node:crypto"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

const MERCHANT_EMAIL_OTP_ALIAS_LENGTH = 6
const MERCHANT_EMAIL_OTP_ALIAS_EXPIRY_MS = 60 * 60 * 1000
const MAX_ALIAS_CREATE_ATTEMPTS = 8

type ConsumeAliasRow = {
  supabase_token: string
}

export function merchantEmailOtpAliasLength() {
  return MERCHANT_EMAIL_OTP_ALIAS_LENGTH
}

export function merchantEmailOtpAliasDigitLabel() {
  if (MERCHANT_EMAIL_OTP_ALIAS_LENGTH === 6) return "six-digit"
  return `${MERCHANT_EMAIL_OTP_ALIAS_LENGTH}-digit`
}

export async function createMerchantEmailOtpAlias({
  email,
  supabaseToken,
}: {
  email: string
  supabaseToken: string
}) {
  const supabase = createSupabaseServiceRoleClient()
  const now = new Date()
  const normalizedEmail = normalizeEmail(email)
  const expiresAt = new Date(
    now.getTime() + MERCHANT_EMAIL_OTP_ALIAS_EXPIRY_MS
  ).toISOString()

  await purgeMerchantEmailOtpAliases(supabase, now)

  for (let attempt = 0; attempt < MAX_ALIAS_CREATE_ATTEMPTS; attempt += 1) {
    const aliasCode = generateAliasCode()
    const { error } = await supabase.from("merchant_email_otp_aliases").insert({
      email: normalizedEmail,
      alias_code: aliasCode,
      supabase_token: supabaseToken,
      expires_at: expiresAt,
    })

    if (!error) return aliasCode
  }

  throw new Error("Unable to create merchant email code.")
}

export async function consumeMerchantEmailOtpAlias({
  email,
  aliasCode,
}: {
  email: string
  aliasCode: string
}) {
  const supabase = createSupabaseServiceRoleClient()
  await purgeMerchantEmailOtpAliases(supabase, new Date())

  const { data, error } = await supabase.rpc(
    "consume_merchant_email_otp_alias",
    {
      p_email: normalizeEmail(email),
      p_alias_code: aliasCode,
    }
  )

  if (error) {
    throw new Error(`Unable to check merchant email code: ${error.message}`)
  }

  const [row] = Array.isArray(data) ? (data as ConsumeAliasRow[]) : []
  return row?.supabase_token ?? null
}

async function purgeMerchantEmailOtpAliases(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  now: Date
) {
  const { error } = await supabase.rpc("purge_merchant_email_otp_aliases", {
    p_now: now.toISOString(),
  })

  if (error) {
    throw new Error(`Unable to clean up merchant email codes: ${error.message}`)
  }
}

function generateAliasCode() {
  return randomInt(0, 10 ** MERCHANT_EMAIL_OTP_ALIAS_LENGTH)
    .toString()
    .padStart(MERCHANT_EMAIL_OTP_ALIAS_LENGTH, "0")
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
