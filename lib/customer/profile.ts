import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { getCurrentCustomer } from "@/lib/customer/identity"
import type { MarketingChannel } from "@/lib/customer/consent"

export type ConsentChannel = MarketingChannel

export type CustomerConsent = {
  channel: ConsentChannel
  optedIn: boolean
}

export type CustomerProfile = {
  fullName: string | null
  dateOfBirth: string | null
  email: string | null
  emailVerified: boolean
  emailLocked: boolean
  needsEmailVerification: boolean
  phone: string | null
  memberSince: string
  membershipCount: number
  consents: CustomerConsent[]
}

/** Redeem-time profile gate: Name + DOB required, email optional but verified. */
export type CustomerProfileCompletion = {
  complete: boolean
  fullName: string | null
  dateOfBirth: string | null
  email: string | null
  emailVerified: boolean
  emailLocked: boolean
  /** Email is present but not yet confirmed — drives the inline verify step. */
  needsEmailVerification: boolean
}

type ProfileFields = {
  fullName: string | null
  dateOfBirth: string | null
  email: string | null
  emailVerifiedAt: string | null
}

/**
 * Pure gate rule (no I/O so it unit-tests against fixtures): a profile is complete
 * when a non-blank name and a date of birth are present, and any entered email has
 * been verified. Phone is already verified at sign-up via phone-first identity.
 */
export function profileCompletionFrom(
  customer: ProfileFields
): CustomerProfileCompletion {
  const fullName = customer.fullName?.trim() ? customer.fullName.trim() : null
  const dateOfBirth = customer.dateOfBirth ?? null
  const email = customer.email?.trim() ? customer.email.trim() : null
  const emailVerified = Boolean(email) && Boolean(customer.emailVerifiedAt)
  const emailLocked = emailVerified
  const needsEmailVerification = Boolean(email) && !customer.emailVerifiedAt
  const complete =
    Boolean(fullName) && Boolean(dateOfBirth) && !needsEmailVerification

  return {
    complete,
    fullName,
    dateOfBirth,
    email,
    emailVerified,
    emailLocked,
    needsEmailVerification,
  }
}

export async function getCustomerProfileCompletion(): Promise<CustomerProfileCompletion | null> {
  const customer = await getCurrentCustomer()
  if (!customer) return null

  return profileCompletionFrom(customer)
}

export type UpdateCustomerProfileInput = {
  fullName: string
  dateOfBirth: string
  email?: string | null
}

export type UpdateCustomerProfileResult = {
  /** True when a (new) email was set and now needs an emailed-code confirmation. */
  emailVerificationRequired: boolean
  email: string | null
  emailLocked: boolean
}

export type ClearCustomerEmailResult = {
  cleared: boolean
  emailLocked: boolean
}

export class CustomerContactLockedError extends Error {
  constructor(message = "Verified contact details are locked.") {
    super(message)
    this.name = "CustomerContactLockedError"
  }
}

/**
 * Persists the redeem-time profile fields. Introducing a *new* email resets its
 * verified state (forcing re-confirmation); an unchanged, already-verified email
 * keeps its standing. A blank email is cleared — phone-first identity keeps the
 * contact-present invariant satisfied via the verified phone.
 */
export async function updateCustomerProfile(
  input: UpdateCustomerProfileInput
): Promise<UpdateCustomerProfileResult> {
  const customer = await getCurrentCustomer()
  if (!customer) throw new Error("No signed-in customer to update.")

  const email = normalizedEmail(input.email)
  const previousEmail = customer.email?.trim() ? customer.email.trim() : null
  const emailLocked = hasLockedVerifiedEmail(customer)
  const keepsVerifiedEmail =
    !emailLocked &&
    email !== null &&
    email === previousEmail &&
    Boolean(customer.emailVerifiedAt)

  const update: Record<string, unknown> = {
    full_name: input.fullName.trim(),
    date_of_birth: input.dateOfBirth,
  }

  if (!emailLocked) {
    update.email = email
    if (!keepsVerifiedEmail) {
      update.email_verified_at = null
    }
  }

  const emailVerificationRequired =
    !emailLocked && email !== null && !keepsVerifiedEmail
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase
    .from("customers")
    .update(update)
    .eq("id", customer.id)

  if (error) throw new Error(`Unable to update profile: ${error.message}`)

  return {
    emailVerificationRequired,
    email: emailLocked ? previousEmail : email,
    emailLocked,
  }
}

/** Confirms an email after the emailed code is accepted. */
export async function markCustomerEmailVerified(email: string): Promise<void> {
  const customer = await getCurrentCustomer()
  if (!customer) throw new Error("No signed-in customer to confirm.")

  const verifiedEmail = normalizedEmail(email)
  if (!verifiedEmail) throw new Error("Email is required for confirmation.")

  const currentEmail = normalizedEmail(customer.email)
  if (hasLockedVerifiedEmail(customer)) {
    if (verifiedEmail !== currentEmail) {
      throw new CustomerContactLockedError("Verified email is locked.")
    }
    return
  }

  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase
    .from("customers")
    .update({
      email: verifiedEmail,
      email_verified_at: new Date().toISOString(),
    })
    .eq("id", customer.id)

  if (error) throw new Error(`Unable to confirm email: ${error.message}`)
}

export async function clearCustomerEmail(): Promise<ClearCustomerEmailResult> {
  const customer = await getCurrentCustomer()
  if (!customer) throw new Error("No signed-in customer to update.")

  if (hasLockedVerifiedEmail(customer)) {
    return { cleared: false, emailLocked: true }
  }

  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase
    .from("customers")
    .update({ email: null, email_verified_at: null })
    .eq("id", customer.id)

  if (error) throw new Error(`Unable to update profile: ${error.message}`)

  return { cleared: true, emailLocked: false }
}

/**
 * Account-level detail for the signed-in customer: contact channels, when they
 * joined, how many venues they belong to, and their global marketing-consent state
 * per channel — the latest `consent_records` row per channel (writes go through
 * `updateCustomerMarketingConsent`). Returns `null` for a signed-in user with no
 * `customers` row yet.
 */
export async function getCustomerProfile(): Promise<CustomerProfile | null> {
  const customer = await getCurrentCustomer()

  if (!customer) return null

  const supabase = createSupabaseServiceRoleClient()

  const [membershipResult, consentResult] = await Promise.all([
    supabase
      .from("customer_memberships")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.id),
    supabase
      .from("consent_records")
      .select("channel, consent_status, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
  ])

  if (membershipResult.error) {
    throw new Error(
      `Unable to load memberships: ${membershipResult.error.message}`
    )
  }
  if (consentResult.error) {
    throw new Error(`Unable to load consents: ${consentResult.error.message}`)
  }

  // Keep only the latest record per channel (rows arrive newest-first).
  const latestByChannel = new Map<ConsentChannel, boolean>()
  for (const row of consentResult.data ?? []) {
    const channel = row.channel as ConsentChannel
    if (!latestByChannel.has(channel)) {
      latestByChannel.set(channel, row.consent_status === "opted_in")
    }
  }

  const consents: CustomerConsent[] = [...latestByChannel.entries()].map(
    ([channel, optedIn]) => ({ channel, optedIn })
  )

  const completion = profileCompletionFrom(customer)

  return {
    fullName: completion.fullName,
    dateOfBirth: completion.dateOfBirth,
    email: customer.email,
    emailVerified: completion.emailVerified,
    emailLocked: completion.emailLocked,
    needsEmailVerification: completion.needsEmailVerification,
    phone: customer.phone,
    memberSince: customer.createdAt,
    membershipCount: membershipResult.count ?? 0,
    consents,
  }
}

function hasLockedVerifiedEmail(customer: {
  email: string | null
  emailVerifiedAt: string | null
}) {
  return (
    Boolean(normalizedEmail(customer.email)) &&
    Boolean(customer.emailVerifiedAt)
  )
}

function normalizedEmail(email: string | null | undefined) {
  return email?.trim() ? email.trim() : null
}
