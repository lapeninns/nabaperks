import "server-only"

import type { ContactEventSurface } from "@/lib/customer/contact-event-core"
import { logger } from "@/lib/observability/logger"
import type { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

type ServiceRoleClient = ReturnType<typeof createSupabaseServiceRoleClient>

export type CustomerEmailAuditAction =
  | "customer_email_submitted"
  | "customer_email_verified"
  | "customer_email_cleared"

export type CustomerEmailAuditInput = {
  readonly customerId: string
  readonly action: CustomerEmailAuditAction
  readonly surface: ContactEventSurface | null
  /** True when only a missing or stale HMAC was rewritten on a locked email. */
  readonly hmacRepairOnly?: boolean
  /** Why an address was cleared without the guest asking. */
  readonly reason?: "email_in_use"
}

type CustomerContactAuditInput = {
  readonly customerId: string
  readonly action: CustomerEmailAuditAction | "customer_phone_attached"
  readonly surface: ContactEventSurface | null
  readonly hmacRepairOnly?: boolean
  readonly reason?: CustomerEmailAuditInput["reason"]
  readonly failureEvent: string
}

/**
 * Durable audit evidence for a customer's own email change, written to
 * `audit_logs` in the same request, straight after the `customers` update and
 * before any provider delivery. It follows the customer-actor convention used
 * by self-service RPCs (`actor_type 'customer'`, `actor_id` the customer id).
 *
 * The row names the customer and the surface only: never the address, its
 * HMAC or a code. The mutation has already committed, so a failed audit write
 * is logged as an error rather than reported to the guest as a failed save.
 */
export async function recordCustomerEmailAudit(
  supabase: ServiceRoleClient,
  input: CustomerEmailAuditInput
): Promise<void> {
  await recordCustomerContactAudit(supabase, {
    ...input,
    failureEvent: "customer_email_audit_failed",
  })
}

/**
 * The same evidence for a verified phone added to an email-only wallet. The
 * row never holds the number, its HMAC, last four digits or the code.
 *
 * Unlike the email writer this reports whether the row was written: the
 * phone is added only after its audit row exists, and a failed write makes
 * the caller take its staged phone off again.
 */
export async function recordCustomerPhoneAttachedAudit(
  supabase: ServiceRoleClient,
  input: { readonly customerId: string; readonly surface: ContactEventSurface }
): Promise<boolean> {
  return recordCustomerContactAudit(supabase, {
    ...input,
    action: "customer_phone_attached",
    failureEvent: "customer_phone_audit_failed",
  })
}

/** Writes the row; failures are logged without contact data. True if written. */
async function recordCustomerContactAudit(
  supabase: ServiceRoleClient,
  input: CustomerContactAuditInput
): Promise<boolean> {
  const metadata: Record<string, string | boolean> = {}
  if (input.surface) metadata.surface = input.surface
  if (input.hmacRepairOnly) metadata.hmac_repair_only = true
  if (input.reason) metadata.reason = input.reason

  try {
    const { error } = await supabase.from("audit_logs").insert({
      actor_type: "customer",
      actor_id: input.customerId,
      customer_id: input.customerId,
      target_table: "customers",
      target_id: input.customerId,
      action: input.action,
      metadata,
    })
    if (!error) return true
    logger.error(input.failureEvent, {
      action: input.action,
      code: error.code,
    })
  } catch (error) {
    logger.error(input.failureEvent, {
      action: input.action,
      error: error instanceof Error ? error.name : "unknown",
    })
  }
  return false
}
