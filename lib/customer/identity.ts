import "server-only"

import { cache } from "react"
import { after } from "next/server"

import type { ContactEventSurface } from "@/lib/customer/contact-event-core"
import { recordCustomerPhoneAttachedAudit } from "@/lib/customer/email-audit"
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
import { customerHasVerifiedPhone } from "@/lib/customer/phone-verification-state"
import { attachRewardInvitesForCustomer } from "@/lib/customer/reward-invites"
import { resolveCustomerSession } from "@/lib/customer/session"
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

export async function findCustomerByVerifiedPhone(
  phone: NormalizedPhone
): Promise<CurrentCustomer | null> {
  const supabase = createSupabaseServiceRoleClient()
  const phoneHmac = customerPhoneHmac(phone.e164)
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("phone_hmac", phoneHmac)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load customer: ${error.message}`)
  }

  return data ? toCurrentCustomer(data) : null
}

export async function getOrCreateCustomerByVerifiedPhone(
  phone: NormalizedPhone
): Promise<{ customer: CurrentCustomer; created: boolean }> {
  const existing = await findCustomerByVerifiedPhone(phone)
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
      const raced = await findCustomerByVerifiedPhone(phone)
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
 * form that `lower(btrim(email))` indexes; an older row stored otherwise is
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
  /** The audit row could not be written, so the phone was taken off again. */
  | { readonly status: "audit_failed" }

/**
 * Adds a phone the signed-in customer has just proven to their wallet, which
 * must not have a verified phone yet. A phone another wallet holds
 * is a conflict and nothing changes. The first write is guarded by
 * `phone_verified_at is null`, allowing interrupted staging to recover while
 * preventing a concurrent attach from overwriting a verified phone. The
 * unique `phone_hmac` index turns a race with another wallet into a
 * conflict too.
 *
 * The phone is never acknowledged without its `audit_logs` row. PostgREST
 * cannot put both writes in one transaction, and once `phone_verified_at` is
 * set `prevent_verified_customer_contact_change` refuses to clear the phone,
 * even for the service role. So the phone is written first WITHOUT its
 * verified timestamp, then audited, and only then marked verified. If the
 * audit write fails, this call's own staged phone is released (the database
 * allows that while the timestamp is null) and `audit_failed` is returned.
 * If the release or the final step fails, this throws rather than report an
 * attach it cannot stand behind.
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
  const holder = await findCustomerByVerifiedPhone(phone)
  if (holder && holder.id !== customerId) {
    return { status: "contact_conflict" }
  }
  if (await customerHasVerifiedPhone(customerId)) {
    return { status: "already_has_phone" }
  }

  const pii = customerPhonePii(phone.e164)
  const supabase = createSupabaseServiceRoleClient()
  const { data: staged, error } = await supabase
    .from("customers")
    .update({
      phone_hmac: pii.phoneHmac,
      phone_ciphertext: pii.phoneCiphertext,
      phone_last4: pii.phoneLast4,
      phone_country: phone.country,
    })
    .eq("id", customerId)
    .is("phone_verified_at", null)
    .select("id")
    .maybeSingle()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { status: "contact_conflict" }
    throw new Error(`Unable to add customer phone: ${error.message}`)
  }
  // No row matched: the wallet verified a phone since the check above.
  if (!staged) return { status: "already_has_phone" }

  const staging = { supabase, customerId, phoneHmac: pii.phoneHmac }
  const audited = await recordCustomerPhoneAttachedAudit(supabase, {
    customerId,
    surface,
  })
  if (!audited) {
    await releaseStagedPhone(staging)
    return { status: "audit_failed" }
  }

  const customer = await markStagedPhoneVerified(staging)
  // A merchant may have sent this phone a reward invite before it was added.
  after(() => attachRewardInvitesForCustomer(customer.id))

  return { status: "attached", customer }
}

type StagedPhone = {
  readonly supabase: ReturnType<typeof createSupabaseServiceRoleClient>
  readonly customerId: string
  readonly phoneHmac: string
}

/** Sets the verified timestamp on the phone this call staged, and only that. */
async function markStagedPhoneVerified(
  staged: StagedPhone
): Promise<CurrentCustomer> {
  const { data, error } = await staged.supabase
    .from("customers")
    .update({ phone_verified_at: new Date().toISOString() })
    .eq("id", staged.customerId)
    .eq("phone_hmac", staged.phoneHmac)
    .is("phone_verified_at", null)
    .select(CUSTOMER_COLUMNS)
    .maybeSingle()

  const customer = error ? null : toCurrentCustomer(data)
  if (customer) return customer

  // The audit row already says added, but an unverified phone must not stay.
  await releaseStagedPhone(staged)
  throw new Error(
    `Unable to confirm customer phone: ${error?.message ?? "row not found"}`
  )
}

/**
 * Takes off the phone this call staged: only while the row still holds this
 * call's phone and no verified timestamp, so nothing else is ever cleared.
 */
async function releaseStagedPhone(staged: StagedPhone): Promise<void> {
  const { data, error } = await staged.supabase
    .from("customers")
    .update({
      phone_hmac: null,
      phone_ciphertext: null,
      phone_last4: null,
      phone_country: null,
    })
    .eq("id", staged.customerId)
    .eq("phone_hmac", staged.phoneHmac)
    .is("phone_verified_at", null)
    .select("id")
    .maybeSingle()

  if (error || !data) {
    throw new Error(
      `Unable to release unaudited customer phone: ${error?.message ?? "row not found"}`
    )
  }
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
