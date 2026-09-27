import "server-only"

import { after } from "next/server"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  customerEmailHmac,
  normalizeEmail as normalizeCustomerEmail,
} from "@/lib/customer/email-pii-core"
import {
  profileCompletionFrom,
  type CustomerProfileCompletion,
} from "@/lib/customer/profile-completion"
import { attachRewardInvitesForCustomer } from "@/lib/customer/reward-invites"
import type { MarketingChannel } from "@/lib/customer/consent"

export { profileCompletionFrom }
export type { CustomerProfileCompletion }

export type ConsentChannel = MarketingChannel

export type CustomerConsent = {
  channel: ConsentChannel
  optedIn: boolean
}

export type PhoneMessagingPreferences = {
  readonly phoneMessagesEnabled: boolean
  readonly preferredPhoneChannel: "whatsapp" | "sms"
  readonly whatsappUnavailableAt: string | null
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
  phoneMessagingPreferences: PhoneMessagingPreferences | null
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
    update.email_hmac =
      keepsVerifiedEmail && email ? customerEmailHmac(email) : null
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

export type MarkCustomerEmailVerifiedResult =
  { status: "verified" } | { status: "conflict" }

/** Copy shown wherever a verified email turns out to belong to another wallet. */
export const CUSTOMER_EMAIL_CONFLICT_MESSAGE =
  "This email is already used by another Nabaperks wallet. Sign in with that email, or ask the venue for help."

const UNIQUE_VIOLATION = "23505"

/**
 * Confirms an email after the emailed code is accepted. One wallet per verified
 * email: when another customer already holds this verified email, nothing
 * changes and the caller receives `conflict`. The pre-check covers today's
 * data; the unique-violation catch covers a concurrent confirmation and the
 * database index that enforces the same rule.
 */
export async function markCustomerEmailVerified(
  email: string
): Promise<MarkCustomerEmailVerifiedResult> {
  const customer = await getCurrentCustomer()
  if (!customer) throw new Error("No signed-in customer to confirm.")

  const verifiedEmail = normalizedEmail(email)
  if (!verifiedEmail) throw new Error("Email is required for confirmation.")

  const currentEmail = normalizedEmail(customer.email)
  const emailHmac = customerEmailHmac(verifiedEmail)
  const supabase = createSupabaseServiceRoleClient()
  const locked = hasLockedVerifiedEmail(customer)
  if (locked && verifiedEmail !== currentEmail) {
    throw new CustomerContactLockedError("Verified email is locked.")
  }

  if (
    await verifiedEmailHeldByAnotherCustomer(supabase, customer.id, emailHmac)
  ) {
    return { status: "conflict" }
  }

  const update = locked
    ? { email_hmac: emailHmac }
    : {
        email: verifiedEmail,
        email_hmac: emailHmac,
        email_verified_at: new Date().toISOString(),
      }
  const { error } = await supabase
    .from("customers")
    .update(update)
    .eq("id", customer.id)

  if (error?.code === UNIQUE_VIOLATION) return { status: "conflict" }
  if (error) throw new Error(`Unable to confirm email: ${error.message}`)

  if (!locked) {
    // A newly verified email may match a pending reward invite — attach it.
    after(() => attachRewardInvitesForCustomer(customer.id))
  }
  return { status: "verified" }
}

async function verifiedEmailHeldByAnotherCustomer(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  customerId: string,
  emailHmac: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("email_hmac", emailHmac)
    .not("email_verified_at", "is", null)
    .neq("id", customerId)
    .limit(1)

  if (error) throw new Error(`Unable to check email: ${error.message}`)
  return (data ?? []).length > 0
}

export type SetCustomerEmailForVerificationResult =
  | { status: "verification_required"; email: string }
  | { status: "already_verified" }

/**
 * Saves only the email, for the "add your email" prompts. `updateCustomerProfile`
 * needs a name and date of birth, which these prompts do not ask for. A new or
 * changed address clears any earlier verification; a customer who already holds
 * a verified email keeps it (verified contacts are locked).
 */
export async function setCustomerEmailForVerification(
  email: string
): Promise<SetCustomerEmailForVerificationResult> {
  const customer = await getCurrentCustomer()
  if (!customer) throw new Error("No signed-in customer to update.")
  if (hasLockedVerifiedEmail(customer)) return { status: "already_verified" }

  const nextEmail = normalizedEmail(email)
  if (!nextEmail) throw new Error("Email is required.")

  if (nextEmail !== normalizedEmail(customer.email)) {
    const supabase = createSupabaseServiceRoleClient()
    const { error } = await supabase
      .from("customers")
      .update({ email: nextEmail, email_hmac: null, email_verified_at: null })
      .eq("id", customer.id)

    if (error) throw new Error(`Unable to update email: ${error.message}`)
  }

  return { status: "verification_required", email: nextEmail }
}

/** True when the customer holds a verified (and therefore locked) email. */
export function customerHasVerifiedEmail(customer: {
  email: string | null
  emailVerifiedAt: string | null
}): boolean {
  return hasLockedVerifiedEmail(customer)
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
    .update({ email: null, email_hmac: null, email_verified_at: null })
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

  const [membershipResult, consentResult, phoneResult] = await Promise.all([
    supabase
      .from("customer_memberships")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.id),
    supabase
      .from("consent_records")
      .select("channel, consent_status, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_notification_preferences_for_customer", {
      p_customer_id: customer.id,
    }),
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
  const phone: unknown = Array.isArray(phoneResult.data)
    ? phoneResult.data[0]
    : phoneResult.data
  const phoneMessagingPreferences: PhoneMessagingPreferences | null =
    !phoneResult.error &&
    phone &&
    typeof phone === "object" &&
    "phone_messages_enabled" in phone &&
    typeof phone.phone_messages_enabled === "boolean" &&
    "preferred_phone_channel" in phone &&
    (phone.preferred_phone_channel === "whatsapp" ||
      phone.preferred_phone_channel === "sms") &&
    "whatsapp_unavailable_at" in phone &&
    (phone.whatsapp_unavailable_at === null ||
      typeof phone.whatsapp_unavailable_at === "string")
      ? {
          phoneMessagesEnabled: phone.phone_messages_enabled,
          preferredPhoneChannel: phone.preferred_phone_channel,
          whatsappUnavailableAt: phone.whatsapp_unavailable_at,
        }
      : null

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
    phoneMessagingPreferences,
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
  return email?.trim() ? normalizeCustomerEmail(email) : null
}
