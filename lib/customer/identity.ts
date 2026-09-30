import "server-only"

import { cache } from "react"
import { after } from "next/server"

import type { ContactEventSurface } from "@/lib/customer/contact-event-core"
import {
  customerEmailHmac,
  normalizeEmail,
} from "@/lib/customer/email-pii-core"
import {
  customerPhoneHmac,
  customerPhonePii,
  maskedPhoneFromLast4,
} from "@/lib/customer/phone-pii"
import type { NormalizedPhone } from "@/lib/customer/phone"
import { attachRewardInvitesForCustomer } from "@/lib/customer/reward-invites"
import { resolveCustomerSession } from "@/lib/customer/session"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type CurrentCustomer = {
  id: string
  authUserId: string | null
  email: string | null
  emailVerifiedAt: string | null
  fullName: string | null
  dateOfBirth: string | null
  dateOfBirthVerifiedAt: string | null
  phone: string | null
  phoneLast4: string | null
  phoneCountry: string | null
  createdAt: string
}

const CUSTOMER_COLUMNS =
  "id, auth_user_id, email, email_verified_at, full_name, date_of_birth, date_of_birth_verified_at, phone_last4, phone_country, created_at"

export const getCurrentCustomer = cache(
  async (): Promise<CurrentCustomer | null> => {
    const resolved = await resolveCustomerSession()
    if (!resolved) return null

    const { customer } = resolved
    if (customer.status === "customer_missing") return null
    if (customer.status === "active") return toCurrentCustomer(customer.row)

    // The merged session RPC is not deployed yet: read the row ourselves for
    // one release rather than fail every authenticated request.
    return loadCustomerById(resolved.payload.customerId)
  }
)

async function loadCustomerById(
  customerId: string
): Promise<CurrentCustomer | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("id", customerId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load customer: ${error.message}`)
  }

  return data ? toCurrentCustomer(data) : null
}

/** The surfaces that open a wallet by a phone the person has just proven. */
type ProvenPhoneSurface = Extract<ContactEventSurface, "home_login" | "join">

/**
 * The wallet phone sign-in and join open for a phone the caller has JUST
 * PROVEN with a code, or null. Call it only after the code was accepted.
 *
 * It matches any live wallet that holds the phone, verified or not: whoever
 * proves the number gets the wallet that holds it (the attach conflict check
 * applies the same rule). A holder whose phone was never marked verified (a
 * legacy row, or an attach that stopped half way) has its phone marked
 * verified here, with an audit row, because the person has just proven
 * possession (QA BUG-031). If that step fails the wallet still opens and the
 * failure is logged, so sign-in keeps working while the database function is
 * rolled out.
 *
 * An erased wallet is never returned: erasure is final even if a row still
 * holds the phone, for example one left by an attach that raced an erasure
 * before the attach was made atomic (QA BUG-002).
 */
export async function findCustomerByVerifiedPhone(
  phone: NormalizedPhone,
  surface: ProvenPhoneSurface = "home_login"
): Promise<CurrentCustomer | null> {
  const supabase = createSupabaseServiceRoleClient()
  const phoneHmac = customerPhoneHmac(phone.e164)
  const { data, error } = await supabase
    .from("customers")
    .select(`${CUSTOMER_COLUMNS}, phone_verified_at`)
    .eq("phone_hmac", phoneHmac)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load customer: ${error.message}`)
  }

  const customer = data ? toCurrentCustomer(data) : null
  if (!customer || isErasedCustomerEmail(customer.email)) return null
  if (!isRecord(data) || data.phone_verified_at !== null) return customer

  return (await verifyProvenPhone(customer.id, phoneHmac, surface))
    ? customer
    : null
}

/**
 * Marks the holder's phone verified after a proven sign-in
 * (`verify_customer_phone_on_sign_in`, 20261009110300). False only when the
 * wallet was erased or lost this phone since it was read, so it must not open.
 */
async function verifyProvenPhone(
  customerId: string,
  phoneHmac: string,
  surface: ProvenPhoneSurface
): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "verify_customer_phone_on_sign_in",
    {
      p_customer_id: customerId,
      p_phone_hmac: phoneHmac,
      p_surface: surface,
    }
  )

  switch (error ? null : data) {
    case "verified":
    case "already_verified":
      return true
    case "phone_changed":
    case "wallet_unavailable":
      return false
    default:
      logger.error("customer_phone_sign_in_verify_failed", {
        surface,
        reason: error ? (error.code ?? "rpc_error") : "unexpected_outcome",
      })
      return true
  }
}

/** The placeholder address every erasure path writes in place of the email. */
const ERASED_EMAIL = /^erased\+[^@]*@privacy\.invalid$/

function isErasedCustomerEmail(email: string | null): boolean {
  return email !== null && ERASED_EMAIL.test(email)
}

export async function getOrCreateCustomerByVerifiedPhone(
  phone: NormalizedPhone
): Promise<{ customer: CurrentCustomer; created: boolean }> {
  const existing = await findCustomerByVerifiedPhone(phone, "join")
  if (existing) return { customer: existing, created: false }

  const supabase = createSupabaseServiceRoleClient()
  const pii = customerPhonePii(phone.e164)
  const { data, error } = await supabase
    .from("customers")
    .insert({
      auth_user_id: null,
      email: null,
      phone_hmac: pii.phoneHmac,
      phone_ciphertext: pii.phoneCiphertext,
      phone_last4: pii.phoneLast4,
      phone_country: phone.country,
      phone_verified_at: new Date().toISOString(),
    })
    .select(CUSTOMER_COLUMNS)
    .single()

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      const raced = await findCustomerByVerifiedPhone(phone, "join")
      if (raced) return { customer: raced, created: false }
    }

    throw new Error(`Unable to create customer: ${error.message}`)
  }

  const customer = toCurrentCustomer(data)
  if (!customer) {
    throw new Error("Unable to create customer.")
  }

  // Single creation choke point: a merchant may have sent this phone a reward
  // invite before they joined — attach any match (best-effort, after response).
  after(() => attachRewardInvitesForCustomer(customer.id))

  return { customer, created: true }
}

/**
 * The wallet that holds this email as a VERIFIED address, or null (D3). An
 * unverified email on a wallet grants nothing, so it is never matched here.
 */
export async function findCustomerByVerifiedEmail(
  email: string
): Promise<CurrentCustomer | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("email_hmac", customerEmailHmac(email))
    .not("email_verified_at", "is", null)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load customer: ${error.message}`)
  }

  return data ? toCurrentCustomer(data) : null
}

const UNIQUE_VIOLATION = "23505"

export type VerifiedEmailWallet =
  | { readonly status: "created"; readonly customer: CurrentCustomer }
  | { readonly status: "existing"; readonly customer: CurrentCustomer }
  /** Another wallet holds the address but could not be matched to it. */
  | { readonly status: "conflict" }

/**
 * Starts a wallet for an email the caller has just proven. The only place an
 * email-only wallet is created, and only after the customer chose to on the
 * join page (D2).
 *
 * The insert can lose to either verified-email index (20261006100000). A
 * concurrent creation of the same address is found again by its HMAC. A wallet
 * whose HMAC is missing or stale (a key rotation or repair mismatch) is found
 * by the normalised address the address index protects, and opened only
 * because that row's email is verified. Anything else is a `conflict`: the
 * address is held elsewhere and nothing is created or opened.
 */
export async function createCustomerByVerifiedEmail(
  email: string
): Promise<VerifiedEmailWallet> {
  const verifiedEmail = normalizeEmail(email)
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customers")
    .insert({
      auth_user_id: null,
      email: verifiedEmail,
      email_hmac: customerEmailHmac(verifiedEmail),
      email_verified_at: new Date().toISOString(),
    })
    .select(CUSTOMER_COLUMNS)
    .single()

  if (error) {
    if (error.code !== UNIQUE_VIOLATION) {
      throw new Error(`Unable to create customer: ${error.message}`)
    }
    const holder =
      (await findCustomerByVerifiedEmail(verifiedEmail)) ??
      (await findCustomerByVerifiedAddress(verifiedEmail))
    return holder
      ? { status: "existing", customer: holder }
      : { status: "conflict" }
  }

  const customer = toCurrentCustomer(data)
  if (!customer) {
    throw new Error("Unable to create customer.")
  }

  // A merchant may have sent this address a reward invite before they joined.
  after(() => attachRewardInvitesForCustomer(customer.id))

  return { status: "created", customer }
}

/**
 * The one wallet whose VERIFIED email is exactly this normalised address, or
 * null. Exact equality, never a pattern, so an address holding `%` or `_`
 * cannot match another. This app writes verified emails in the normalised
 * form the address index keys on (`normalizeEmail`: Unicode edge whitespace
 * trimmed, lower case, NFC; 20261009110100); an older row stored otherwise is
 * not matched, and the caller treats the address as held elsewhere.
 */
async function findCustomerByVerifiedAddress(
  email: string
): Promise<CurrentCustomer | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("email", normalizeEmail(email))
    .not("email_verified_at", "is", null)
    .limit(2)

  if (error) {
    throw new Error(`Unable to load customer: ${error.message}`)
  }

  const rows = Array.isArray(data) ? data : []
  return rows.length === 1 ? toCurrentCustomer(rows[0]) : null
}

export type AttachVerifiedPhoneResult =
  | { readonly status: "attached"; readonly customer: CurrentCustomer }
  /** Another wallet holds this phone. Nothing changes (D4: attach, never merge). */
  | { readonly status: "contact_conflict" }
  /** This wallet already has a phone, so there is nothing to add. */
  | { readonly status: "already_has_phone" }
  /** The audit row could not be written, so nothing was written. */
  | { readonly status: "audit_failed" }
  /** The wallet was erased or removed while the code was being checked. */
  | { readonly status: "wallet_unavailable" }

/**
 * Adds a phone the signed-in customer has just proven to their wallet, which
 * must not have a verified phone yet. A phone another wallet holds is a
 * conflict and nothing changes.
 *
 * `attach_verified_customer_phone` (20261009110000) does it in one
 * transaction under the customer row lock: it re-checks that the wallet is
 * live and has no verified phone, writes the phone with its verified
 * timestamp, and inserts the one `customer_phone_attached` audit row. The
 * phone is therefore never acknowledged without its audit row, an erasure
 * that lands while the code is checked wins (`wallet_unavailable`), and an
 * overlapping confirmation on the same wallet gets `already_has_phone`
 * instead of a second audit row (QA BUG-002, BUG-013).
 */
export async function attachVerifiedPhoneToCustomer({
  customerId,
  phone,
  surface,
}: {
  customerId: string
  phone: NormalizedPhone
  surface: ContactEventSurface
}): Promise<AttachVerifiedPhoneResult> {
  const pii = customerPhonePii(phone.e164)
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("attach_verified_customer_phone", {
    p_customer_id: customerId,
    p_phone_hmac: pii.phoneHmac,
    p_phone_ciphertext: pii.phoneCiphertext,
    p_phone_last4: pii.phoneLast4,
    p_phone_country: phone.country,
    p_surface: surface,
  })

  if (error) {
    throw new Error(`Unable to add customer phone: ${error.message}`)
  }

  switch (data) {
    case "attached":
      return {
        status: "attached",
        customer: await attachedCustomer(customerId),
      }
    case "audit_failed":
      logger.error("customer_phone_audit_failed", {
        action: "customer_phone_attached",
      })
      return { status: "audit_failed" }
    case "already_has_phone":
    case "contact_conflict":
    case "wallet_unavailable":
      return { status: data }
    default:
      throw new Error("Unable to add customer phone: unexpected outcome")
  }
}

async function attachedCustomer(customerId: string): Promise<CurrentCustomer> {
  const customer = await loadCustomerById(customerId)
  if (!customer) {
    throw new Error("Unable to load customer after adding a phone.")
  }
  // A merchant may have sent this phone a reward invite before it was added.
  after(() => attachRewardInvitesForCustomer(customer.id))
  return customer
}

export function firstOf<T>(value: T | T[] | null): T | null {
  if (value === null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function toCurrentCustomer(row: unknown): CurrentCustomer | null {
  if (!isRecord(row)) return null

  const id = stringValue(row.id)
  const createdAt = stringValue(row.created_at)
  if (!id || !createdAt) return null

  const phoneLast4 = nullableString(row.phone_last4)

  return {
    id,
    authUserId: nullableString(row.auth_user_id),
    email: nullableString(row.email),
    emailVerifiedAt: nullableString(row.email_verified_at),
    fullName: nullableString(row.full_name),
    dateOfBirth: nullableString(row.date_of_birth),
    dateOfBirthVerifiedAt: nullableString(row.date_of_birth_verified_at),
    // Plaintext phone no longer exists at rest; this is always the masked form.
    phone: maskedPhoneFromLast4(phoneLast4),
    phoneLast4,
    phoneCountry: nullableString(row.phone_country),
    createdAt,
  }
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
