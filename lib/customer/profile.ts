import "server-only"

import { after } from "next/server"
import { cache } from "react"
import { customerHasVerifiedPhone } from "@/lib/customer/phone-verification-state"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { getCurrentCustomer } from "@/lib/customer/identity"
import type {
  ContactEventSurface,
  EmailPromptSurface,
} from "@/lib/customer/contact-event-core"
import { recordCustomerEmailAudit } from "@/lib/customer/email-audit"
import {
  customerEmailHmac,
  normalizeEmail as normalizeCustomerEmail,
} from "@/lib/customer/email-pii-core"
import {
  profileCompletionFrom,
  type CustomerProfileCompletion,
} from "@/lib/customer/profile-completion"
import { attachRewardInvitesForCustomer } from "@/lib/customer/reward-invites"
import { logger } from "@/lib/observability/logger"
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
  phoneVerified: boolean
  memberSince: string
  membershipCount: number
  consents: CustomerConsent[]
  phoneMessagingPreferences: PhoneMessagingPreferences | null
}

export async function getCustomerProfileCompletion(): Promise<CustomerProfileCompletion | null> {
  const customer = await getCurrentCustomer()
  if (!customer) return null

  return profileCompletionFrom({
    ...customer,
    phoneVerified: await customerPhoneVerified(customer.id),
  })
}

const customerPhoneVerified = cache(customerHasVerifiedPhone)

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

const UNIQUE_VIOLATION = "23505"

type ServiceRoleClient = ReturnType<typeof createSupabaseServiceRoleClient>

/**
 * Confirms an email after the emailed code is accepted. One wallet per verified
 * email: when another customer already holds this verified email, this
 * customer ends up without it and the caller receives `conflict`.
 *
 * Three checks hold that rule until the database index does on its own: the
 * pre-check covers today's data, the unique-violation catch covers the index,
 * and a re-check after the write covers two confirmations of the same address
 * racing between the pre-check and the write (see
 * {@link withdrawRacedConfirmation}). On a conflict an unverified copy of the
 * address is also released from this profile (see
 * {@link releaseConflictingEmail}). A confirmation that stands is recorded in
 * `audit_logs` before this returns; a withdrawn one records none.
 */
export async function markCustomerEmailVerified(
  email: string,
  surface: ContactEventSurface | null = null
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

  const conflict = async (): Promise<MarkCustomerEmailVerifiedResult> => {
    // A locked email is verified here already; only an unverified copy goes.
    if (!locked) {
      await releaseConflictingEmail(supabase, {
        customerId: customer.id,
        email: verifiedEmail,
        surface,
      })
    }
    return { status: "conflict" }
  }

  if (
    await verifiedEmailHeldByAnotherCustomer(supabase, customer.id, emailHmac)
  ) {
    return conflict()
  }

  const verifiedAt = new Date().toISOString()
  const update = locked
    ? { email_hmac: emailHmac }
    : {
        email: verifiedEmail,
        email_hmac: emailHmac,
        email_verified_at: verifiedAt,
      }
  const { error } = await supabase
    .from("customers")
    .update(update)
    .eq("id", customer.id)

  if (error?.code === UNIQUE_VIOLATION) return conflict()
  if (error) throw new Error(`Unable to confirm email: ${error.message}`)

  if (
    !locked &&
    (await verifiedEmailHeldByAnotherCustomer(supabase, customer.id, emailHmac))
  ) {
    await withdrawRacedConfirmation(supabase, {
      customerId: customer.id,
      previousEmail: customer.email,
      previousVerifiedAt: customer.emailVerifiedAt,
      verifiedAt,
    })
    return conflict()
  }

  await recordCustomerEmailAudit(supabase, {
    customerId: customer.id,
    action: "customer_email_verified",
    surface,
    hmacRepairOnly: locked,
  })
  if (!locked) {
    // A newly verified email may match a pending reward invite — attach it.
    after(() => attachRewardInvitesForCustomer(customer.id))
  }
  return { status: "verified" }
}

async function verifiedEmailHeldByAnotherCustomer(
  supabase: ServiceRoleClient,
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

/**
 * Undoes this call's own confirmation after the post-write re-check found
 * another verified holder of the same address.
 *
 * Why this is fail-closed without a transaction: every confirmation writes its
 * row first and re-checks second, each as its own committed statement. For two
 * racers A and B to both miss each other, A's re-check would have to run
 * before B's write and B's re-check before A's write, which cannot happen
 * because each writes before it re-checks. So at least one racer sees the
 * other. Both may see each other and both withdraw (both guests get
 * `conflict` and can try again); what cannot remain is two wallets holding the
 * same verified email. The unique index from the follow-up migration makes
 * this re-check redundant once it ships.
 *
 * Only what this call set is reverted: the guard on `email_verified_at` skips
 * the write if anything has replaced this confirmation since. No
 * `customer_email_verified` audit row was written, so none needs undoing. A
 * failed withdrawal is thrown rather than reported as a conflict, because the
 * duplicate would then still stand.
 */
async function withdrawRacedConfirmation(
  supabase: ServiceRoleClient,
  input: {
    readonly customerId: string
    readonly previousEmail: string | null
    readonly previousVerifiedAt: string | null
    readonly verifiedAt: string
  }
): Promise<void> {
  const { error } = await supabase
    .from("customers")
    .update({
      email: input.previousEmail,
      email_hmac: null,
      email_verified_at: input.previousVerifiedAt,
    })
    .eq("id", input.customerId)
    .eq("email_verified_at", input.verifiedAt)

  if (error) {
    logger.error("customer_email_confirmation_withdraw_failed", {
      code: error.code,
    })
    throw new Error(`Unable to withdraw email confirmation: ${error.message}`)
  }
}

/**
 * After a conflict, removes the refused address from this profile so a reload
 * does not prefill it again. Only in one guarded write: the stored email must
 * still be this address and still unverified, and the profile must keep a
 * phone, since `customers_contact_present` requires an email or a phone. A
 * cleared address is recorded in `audit_logs` as `customer_email_cleared`.
 * Best effort: the guest's `conflict` answer stands if this write fails.
 */
async function releaseConflictingEmail(
  supabase: ServiceRoleClient,
  input: {
    readonly customerId: string
    readonly email: string
    readonly surface: ContactEventSurface | null
  }
): Promise<void> {
  const { data, error } = await supabase
    .from("customers")
    .update({ email: null, email_hmac: null, email_verified_at: null })
    .eq("id", input.customerId)
    .eq("email", input.email)
    .is("email_verified_at", null)
    .or("phone_hmac.not.is.null,phone_last4.not.is.null")
    .select("id")

  if (error) {
    logger.warn("customer_email_conflict_release_failed", { code: error.code })
    return
  }
  if ((data ?? []).length === 0) return

  await recordCustomerEmailAudit(supabase, {
    customerId: input.customerId,
    action: "customer_email_cleared",
    surface: input.surface,
    reason: "email_in_use",
  })
}

export type SetCustomerEmailForVerificationResult =
  | { status: "verification_required"; email: string }
  | { status: "already_verified" }

/**
 * Saves only the email, for the "add your email" prompts. `updateCustomerProfile`
 * needs a name and date of birth, which these prompts do not ask for. A new or
 * changed address clears any earlier verification; a customer who already holds
 * a verified email keeps it (verified contacts are locked). A changed address
 * is recorded in `audit_logs` before any code is sent.
 */
export async function setCustomerEmailForVerification(
  email: string,
  surface: EmailPromptSurface
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
    await recordCustomerEmailAudit(supabase, {
      customerId: customer.id,
      action: "customer_email_submitted",
      surface,
    })
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

  const phoneVerified = await customerPhoneVerified(customer.id)
  const completion = profileCompletionFrom({ ...customer, phoneVerified })
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
    phoneVerified,
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
