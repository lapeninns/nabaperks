/**
 * Pure helpers that turn the `admin_export_customer_data` RPC payload into a
 * downloadable file (db privacy lifecycle). No IO and no server-only
 * imports: shared by the `logDataRequestAction` server action and the client
 * `AdminActionForm`, so a GDPR subject-access export the RPC returns actually
 * reaches the admin instead of being discarded.
 */

export const CUSTOMER_DATA_EXPORT_SCHEMA = "nabaperks.customer-data-export.v1"

export type CustomerDataExport = {
  readonly schema: string
  readonly generated_at?: unknown
  readonly customer: { readonly id: string }
}

export type AdminExportDownload = {
  readonly filename: string
  readonly content: string
  readonly mimeType: string
}

/**
 * True only for an `admin_export_customer_data` payload. The `access` /
 * `rectification` / `consent` log result and the `deletion` result are plain
 * `{ ok: … }` objects with no export schema, so they return false.
 */
export function isCustomerDataExport(value: unknown): value is CustomerDataExport {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  if (record.schema !== CUSTOMER_DATA_EXPORT_SCHEMA) return false
  const customer = record.customer
  return (
    typeof customer === "object" &&
    customer !== null &&
    typeof (customer as Record<string, unknown>).id === "string"
  )
}

/** e.g. `customer-data-export-<uuid>-2026-07-10.json`. */
export function buildExportFilename(payload: CustomerDataExport): string {
  return `customer-data-export-${payload.customer.id}-${exportDate(payload.generated_at)}.json`
}

export function serializeExport(payload: CustomerDataExport): string {
  return JSON.stringify(payload, null, 2)
}

/** A JSON download descriptor for an export payload; null for anything else. */
export function buildExportDownload(value: unknown): AdminExportDownload | null {
  if (!isCustomerDataExport(value)) return null
  return {
    filename: buildExportFilename(value),
    content: serializeExport(value),
    mimeType: "application/json",
  }
}

function exportDate(generatedAt: unknown): string {
  if (typeof generatedAt === "string") {
    const match = /^\d{4}-\d{2}-\d{2}/.exec(generatedAt)
    if (match) return match[0]
  }
  return "unknown-date"
}
