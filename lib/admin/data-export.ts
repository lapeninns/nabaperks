/** Server-only presentation and streaming contract for privacy exports. */

export const CUSTOMER_DATA_EXPORT_SCHEMA = "nabaperks.customer-data-export.v2"

export type CustomerDataExport = {
  readonly schema: string
  readonly generated_at: string
  readonly snapshot_id: string
  readonly manifest_snapshot_id: string
  readonly manifest: readonly unknown[]
  readonly sections: Readonly<Record<string, unknown>>
}

/**
 * True only for an `admin_export_customer_data` payload. The `access` /
 * `rectification` / `consent` log result and the `deletion` result are plain
 * `{ ok: … }` objects with no export schema, so they return false.
 */
export function isCustomerDataExport(
  value: unknown
): value is CustomerDataExport {
  if (!isRecord(value)) return false
  const record = value
  if (record.schema !== CUSTOMER_DATA_EXPORT_SCHEMA) return false
  const manifest = record.manifest
  const sections = record.sections
  const snapshotId = record.snapshot_id
  return (
    Array.isArray(manifest) &&
    manifest.length > 0 &&
    typeof record.generated_at === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(record.generated_at) &&
    typeof snapshotId === "string" &&
    snapshotId.length > 0 &&
    record.manifest_snapshot_id === snapshotId &&
    isRecord(sections) &&
    Object.values(sections).length > 0 &&
    Object.values(sections).every(
      (section) =>
        isRecord(section) &&
        section.snapshot_id === snapshotId &&
        Array.isArray(section.rows)
    )
  )
}

/** e.g. `customer-data-export-2026-07-10.json`; never includes subject data. */
export function buildExportFilename(payload: CustomerDataExport): string {
  return `customer-data-export-${exportDate(payload.generated_at)}.json`
}

export function serializeExport(payload: CustomerDataExport): string {
  return JSON.stringify(payload, null, 2)
}

function exportDate(generatedAt: unknown): string {
  if (typeof generatedAt === "string") {
    const match = /^\d{4}-\d{2}-\d{2}/.exec(generatedAt)
    if (match) return match[0]
  }
  return "unknown-date"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const MAX_EXPORT_REQUEST_BYTES = 16_384
const EXPORT_CHANNELS = new Set(["email", "phone", "in_person", "other"])
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
} as const

export type ExportRequest = {
  readonly customerId: string
  readonly merchantId: string
  readonly channel: string
  readonly notes: string
}

type ExportRpcResult = {
  readonly data: unknown
  readonly error: { readonly message?: string } | null
}

type ExportRouteDependencies<TRequest extends Request> = {
  readonly authorise: () => Promise<void>
  readonly exportCustomer: (input: ExportRequest) => Promise<ExportRpcResult>
  readonly sameOrigin: (request: TRequest) => boolean
}

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}

function parseExportRequest(values: FormData): ExportRequest | null {
  const customerId = formText(values, "customerId")
  const merchantId = formText(values, "merchantId")
  const requestType = formText(values, "requestType")
  const channel = formText(values, "channel")
  const notes = formText(values, "notes")

  if (
    !UUID_PATTERN.test(customerId) ||
    !UUID_PATTERN.test(merchantId) ||
    requestType !== "export" ||
    !EXPORT_CHANNELS.has(channel) ||
    notes.length < 4 ||
    notes.length > 2_000
  ) {
    return null
  }
  return { customerId, merchantId, channel, notes }
}

function formText(values: FormData, name: string): string {
  const value = values.get(name)
  return typeof value === "string" ? value.trim() : ""
}

function exportStream(payload: CustomerDataExport): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(serializeExport(payload))
  const chunkSize = 64 * 1_024
  let offset = 0

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) {
        controller.close()
        return
      }
      const end = Math.min(offset + chunkSize, bytes.byteLength)
      controller.enqueue(bytes.slice(offset, end))
      offset = end
    },
    cancel() {
      offset = bytes.byteLength
    },
  })
}

export function createAdminPrivacyExportPost<TRequest extends Request>(
  dependencies: ExportRouteDependencies<TRequest>
): (request: TRequest) => Promise<Response> {
  return async (request) => {
    if (!dependencies.sameOrigin(request)) {
      return textResponse("This export request is not allowed.", 403)
    }
    try {
      await dependencies.authorise()
    } catch {
      return textResponse(
        "Admin verification is required for this export.",
        403
      )
    }

    const contentType = request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase()
    if (contentType !== "application/x-www-form-urlencoded") {
      return textResponse("The export request format is invalid.", 415)
    }
    const declaredLength = request.headers.get("content-length")
    if (
      declaredLength === null ||
      !/^\d+$/.test(declaredLength) ||
      Number(declaredLength) > MAX_EXPORT_REQUEST_BYTES
    ) {
      return textResponse("The export request is too large.", 413)
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return textResponse("The export request could not be read.", 400)
    }
    const input = parseExportRequest(formData)
    if (!input) {
      return textResponse("Customer and request details are invalid.", 400)
    }

    let result: ExportRpcResult
    try {
      result = await dependencies.exportCustomer(input)
    } catch {
      return textResponse(
        "The customer data export could not be produced.",
        503
      )
    }
    if (result.error) {
      return textResponse(
        "The customer data export could not be produced.",
        503
      )
    }
    if (!isCustomerDataExport(result.data)) {
      return textResponse("The customer data export was incomplete.", 422)
    }

    return new Response(exportStream(result.data), {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildExportFilename(result.data)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    })
  }
}
