import "server-only"

import { randomInt } from "node:crypto"

import {
  OtpAliasTokenIntegrityError,
  decryptOtpAliasToken,
  encryptOtpAliasToken,
} from "@/lib/security/otp-alias-token"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

const MERCHANT_EMAIL_OTP_ALIAS_LENGTH = 6
const MERCHANT_EMAIL_OTP_ALIAS_EXPIRY_MS = 60 * 60 * 1000
const MAX_ALIAS_CREATE_ATTEMPTS = 8

export type MerchantEmailOtpPurpose = "signup" | "recovery"
export type MerchantEmailOtpTerminalOutcome =
  | "expired"
  | "rejected"
  | "verified"

type ReserveAliasRow = {
  status: string
  reservation_id: string | null
  supabase_token: string | null
  retry_at: string | null
}

type UnavailableAliasStatus =
  | "busy"
  | "expired"
  | "invalid"
  | "rejected"
  | "superseded"
  | "throttled"
  | "used"

export type MerchantEmailOtpAliasReservation =
  | {
      status: "reserved"
      reservationId: string
      retryAt: null
      supabaseToken: string
    }
  | {
      status: UnavailableAliasStatus
      reservationId: null
      retryAt: string | null
      supabaseToken: null
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
  purpose,
  supabaseToken,
}: {
  email: string
  purpose: MerchantEmailOtpPurpose
  supabaseToken: string
}) {
  const supabase = createSupabaseServiceRoleClient()
  const expiresAt = new Date(
    Date.now() + MERCHANT_EMAIL_OTP_ALIAS_EXPIRY_MS
  ).toISOString()
  let lastError = "missing alias id"

  for (let attempt = 0; attempt < MAX_ALIAS_CREATE_ATTEMPTS; attempt += 1) {
    const aliasCode = generateAliasCode()
    const { data, error } = await supabase.rpc(
      "create_merchant_email_otp_alias",
      {
        p_alias_code: aliasCode,
        p_email: normalizeEmail(email),
        p_expires_at: expiresAt,
        p_purpose: purpose,
        p_supabase_token: encryptOtpAliasToken(supabaseToken),
      }
    )

    if (!error && typeof data === "string") {
      return { aliasCode, aliasId: data }
    }

    // Every retry is safe: a six-digit collision rolls back, while a request
    // whose response was lost is superseded by the next atomic create.
    lastError = error?.message ?? "missing alias id"
  }

  throw new Error(
    `Unable to create merchant email code after safe retries: ${lastError}`
  )
}

export async function reserveMerchantEmailOtpAlias({
  aliasCode,
  email,
  purpose,
}: {
  aliasCode: string
  email: string
  purpose: MerchantEmailOtpPurpose
}): Promise<MerchantEmailOtpAliasReservation> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "reserve_merchant_email_otp_alias",
    {
      p_alias_code: aliasCode,
      p_email: normalizeEmail(email),
      p_purpose: purpose,
    }
  )

  if (error) {
    throw new Error(`Unable to reserve merchant email code: ${error.message}`)
  }

  const [row] = Array.isArray(data) ? (data as ReserveAliasRow[]) : []
  if (!row || !isAliasReservationStatus(row.status)) {
    throw new Error("Unable to reserve merchant email code: invalid response")
  }

  if (row.status !== "reserved") {
    return {
      status: row.status,
      reservationId: null,
      retryAt: row.retry_at,
      supabaseToken: null,
    }
  }

  if (!row.reservation_id || !row.supabase_token) {
    throw new Error("Unable to reserve merchant email code: incomplete lease")
  }

  try {
    return {
      status: "reserved",
      reservationId: row.reservation_id,
      retryAt: null,
      supabaseToken: decryptOtpAliasToken(row.supabase_token),
    }
  } catch (error) {
    // A tampered/garbled token is terminal. A missing/malformed encryption key
    // remains a loud configuration error and must not be silently released.
    if (!(error instanceof OtpAliasTokenIntegrityError)) throw error

    await finalizeMerchantEmailOtpAlias({
      outcome: "rejected",
      reservationId: row.reservation_id,
    })
    return {
      status: "rejected",
      reservationId: null,
      retryAt: null,
      supabaseToken: null,
    }
  }
}

export async function finalizeMerchantEmailOtpAlias({
  outcome,
  reservationId,
}: {
  outcome: MerchantEmailOtpTerminalOutcome
  reservationId: string
}) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "finalize_merchant_email_otp_alias",
    {
      p_outcome: outcome,
      p_reservation_id: reservationId,
    }
  )

  if (error) {
    throw new Error(`Unable to finalize merchant email code: ${error.message}`)
  }

  return data === true
}

export async function releaseMerchantEmailOtpAlias({
  reservationId,
}: {
  reservationId: string
}) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "release_merchant_email_otp_alias",
    {
      p_reservation_id: reservationId,
    }
  )

  if (error) {
    throw new Error(`Unable to release merchant email code: ${error.message}`)
  }

  return data === true
}

export async function revokeMerchantEmailOtpAlias({
  aliasId,
  outcome,
}: {
  aliasId: string
  outcome: "delivery_failed"
}) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "revoke_merchant_email_otp_alias",
    {
      p_alias_id: aliasId,
      p_outcome: outcome,
    }
  )

  if (error) {
    throw new Error(`Unable to revoke merchant email code: ${error.message}`)
  }

  return data === true
}

function generateAliasCode() {
  return randomInt(0, 10 ** MERCHANT_EMAIL_OTP_ALIAS_LENGTH)
    .toString()
    .padStart(MERCHANT_EMAIL_OTP_ALIAS_LENGTH, "0")
}

function isAliasReservationStatus(
  status: string
): status is MerchantEmailOtpAliasReservation["status"] {
  return [
    "busy",
    "expired",
    "invalid",
    "rejected",
    "reserved",
    "superseded",
    "throttled",
    "used",
  ].includes(status)
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
