import "server-only"

import { customerEmailHmac } from "@/lib/customer/email-pii-core"
import { customerPhoneHmac } from "@/lib/customer/phone-pii"
import {
  walletLinkFailureCopy,
  type WalletLinkOutcome,
} from "@/lib/customer/previous-stamps"
import { getCustomerSession, setCustomerSession } from "@/lib/customer/session"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type WalletLinkResult =
  | { readonly status: "linked"; readonly customerId: string }
  | { readonly status: "conflict" | "reauthenticate" | "requires_review" }

export class WalletLinkError extends Error {
  constructor(readonly reason: "database" | "invalid_response") {
    super("Unable to link customer wallets")
    this.name = "WalletLinkError"
  }
}

export async function linkWalletAfterContactVerification(
  method: "phone" | "email",
  contact: string
): Promise<WalletLinkResult> {
  const session = await getCustomerSession()
  if (!session) return { status: "reauthenticate" }
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("link_verified_customer_wallets", {
    p_customer_id: session.customerId,
    p_session_id: session.sessionId,
    p_method: method,
    p_contact_hmac:
      method === "phone"
        ? customerPhoneHmac(contact)
        : customerEmailHmac(contact),
  })
  if (error) throw new WalletLinkError("database")
  const result = parseWalletLinkResult(data)
  switch (result.status) {
    case "linked":
      await setCustomerSession(
        result.customerId,
        method === "phone" ? "verified_phone" : "verified_email"
      )
      return result
    case "conflict":
    case "reauthenticate":
    case "requires_review":
      return result
  }
}

function parseWalletLinkResult(data: unknown): WalletLinkResult {
  if (!Array.isArray(data) || data.length !== 1) {
    throw new WalletLinkError("invalid_response")
  }
  const row: unknown = data[0]
  if (
    !row ||
    typeof row !== "object" ||
    !("status" in row) ||
    !("customer_id" in row)
  ) {
    throw new WalletLinkError("invalid_response")
  }
  switch (row.status) {
    case "linked":
      if (
        typeof row.customer_id !== "string" ||
        !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.customer_id)
      ) {
        throw new WalletLinkError("invalid_response")
      }
      return { status: "linked", customerId: row.customer_id }
    case "conflict":
    case "reauthenticate":
    case "requires_review":
      if (row.customer_id !== null)
        throw new WalletLinkError("invalid_response")
      return { status: row.status }
    default:
      throw new WalletLinkError("invalid_response")
  }
}

/**
 * The guest's words for a link that did not happen, for the contact that was
 * just proven. Copy lives with the rest of the task in
 * `lib/customer/previous-stamps.ts`.
 */
export function walletLinkFailureMessage(
  status: WalletLinkOutcome,
  method: "phone" | "email" = "phone"
): string {
  return walletLinkFailureCopy(status, method)
}
