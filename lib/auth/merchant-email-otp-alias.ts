import "server-only"

import { randomInt } from "node:crypto"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

const MERCHANT_EMAIL_OTP_ALIAS_LENGTH = 4
const MERCHANT_EMAIL_OTP_ALIAS_EXPIRY_MS = 60 * 60 * 1000
const MAX_ALIAS_CREATE_ATTEMPTS = 8

type ConsumeAliasRow = {
  supabase_token: string
}

export function merchantEmailOtpAliasLength() {
  return MERCHANT_EMAIL_OTP_ALIAS_LENGTH
}

export async function createMerchantEmailOtpAlias({
  email,
  supabaseToken,
}: {
  email: string
  supabaseToken: string
}) {
  const supabase = createSupabaseServiceRoleClient()
  const normalizedEmail = normalizeEmail(email)
  const expiresAt = new Date(
    Date.now() + MERCHANT_EMAIL_OTP_ALIAS_EXPIRY_MS
  ).toISOString()

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

function generateAliasCode() {
  return randomInt(0, 10 ** MERCHANT_EMAIL_OTP_ALIAS_LENGTH)
    .toString()
    .padStart(MERCHANT_EMAIL_OTP_ALIAS_LENGTH, "0")
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
