/**
 * Narrows the row returned by `public.touch_customer_session_and_load`.
 *
 * The RPC returns exactly one row whose `status` says what the caller may do
 * with the rest of it. Anything the parser cannot recognise is treated as
 * `inactive`: a session that fails closed costs the customer a re-login, a
 * session that fails open would hand a wallet to the wrong request.
 */
export type CustomerSessionLoadRow =
  | { readonly status: "inactive" }
  | { readonly status: "customer_missing" }
  | { readonly status: "active"; readonly row: Record<string, unknown> }

export function parseCustomerSessionLoadRow(
  data: unknown
): CustomerSessionLoadRow {
  const row = Array.isArray(data) ? data[0] : data
  if (!isRecord(row)) return { status: "inactive" }

  if (row.status === "customer_missing") return { status: "customer_missing" }
  if (row.status === "active" && typeof row.id === "string" && row.id) {
    return { status: "active", row }
  }
  return { status: "inactive" }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
