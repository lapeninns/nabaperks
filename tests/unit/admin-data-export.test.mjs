import assert from "node:assert/strict"
import { test } from "node:test"
import { readFile } from "node:fs/promises"
import { NextRequest } from "next/server.js"

import {
  buildExportFilename,
  createAdminPrivacyExportPost,
  isCustomerDataExport,
  serializeExport,
} from "@/lib/admin/data-export"

/**
 * db privacy lifecycle — pure helpers that turn the `admin_export_customer_data`
 * RPC payload into a downloadable file. No IO: the server action and the client
 * form consume these shapes.
 */

const EXPORT = {
  schema: "nabaperks.customer-data-export.v2",
  generated_at: "2026-07-10T09:41:00.000Z",
  snapshot_id: "snapshot-2026-07-10",
  manifest_snapshot_id: "snapshot-2026-07-10",
  manifest: [{ relation_name: "public.customers" }],
  sections: {
    customer: { snapshot_id: "snapshot-2026-07-10", rows: [] },
  },
  memberships: [],
  stamp_events: [],
}

const ACCESS_LOG = {
  ok: true,
  request_type: "access",
  manual_follow_up_required: true,
}
const DELETION = { ok: true, request_type: "deletion", ledger_retained: true }

test("isCustomerDataExport accepts an export payload and rejects everything else", () => {
  assert.equal(isCustomerDataExport(EXPORT), true)
  assert.equal(isCustomerDataExport(ACCESS_LOG), false)
  assert.equal(isCustomerDataExport(DELETION), false)
  assert.equal(isCustomerDataExport(null), false)
  assert.equal(isCustomerDataExport(undefined), false)
  assert.equal(isCustomerDataExport("nope"), false)
  assert.equal(
    isCustomerDataExport({ schema: "nabaperks.customer-data-export.v2" }),
    false
  )
  assert.equal(
    isCustomerDataExport({
      schema: "nabaperks.customer-data-export.v2",
      generated_at: EXPORT.generated_at,
      manifest: EXPORT.manifest,
    }),
    false
  )
  assert.equal(
    isCustomerDataExport({
      ...EXPORT,
      sections: {
        customer: { snapshot_id: "different-snapshot", rows: [] },
      },
    }),
    false
  )
})

test("buildExportFilename uses a neutral filename with only the export date", () => {
  assert.equal(
    buildExportFilename(EXPORT),
    "customer-data-export-2026-07-10.json"
  )
})

test("serializeExport pretty-prints the exact payload", () => {
  const serialized = serializeExport(EXPORT)
  assert.deepEqual(JSON.parse(serialized), EXPORT)
  assert.ok(serialized.includes("\n"), "output is pretty-printed")
})

function exportRequest(overrides = {}) {
  const body = new URLSearchParams({
    customerId: "11111111-2222-4333-8444-555555555555",
    merchantId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    requestType: "export",
    channel: "email",
    notes: "Verified support request",
    ...overrides,
  })
  const encodedBody = body.toString()
  return new NextRequest("https://nabaperks.com/admin/privacy/export", {
    method: "POST",
    headers: {
      origin: "https://nabaperks.com",
      "content-type": "application/x-www-form-urlencoded",
      "content-length": String(Buffer.byteLength(encodedBody)),
    },
    body: encodedBody,
  })
}

function exportPost(overrides = {}) {
  return createAdminPrivacyExportPost({
    authorise: async () => {},
    sameOrigin: () => true,
    exportCustomer: async () => ({ data: EXPORT, error: null }),
    ...overrides,
  })
}

test("protected POST streams complete JSON with no-store and a neutral attachment", async () => {
  const response = await exportPost()(exportRequest())

  assert.equal(response.status, 200)
  assert.ok(response.body instanceof ReadableStream)
  assert.match(response.headers.get("cache-control") ?? "", /no-store/)
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="customer-data-export-2026-07-10.json"'
  )
  assert.deepEqual(JSON.parse(await response.text()), EXPORT)
})

test("protected POST accepts PostgreSQL UUID text without RFC version or variant bits", async () => {
  let exportCalls = 0
  const response = await exportPost({
    exportCustomer: async () => {
      exportCalls += 1
      return { data: EXPORT, error: null }
    },
  })(
    exportRequest({
      customerId: "16000000-0000-0000-0000-000000000002",
      merchantId: "15000000-0000-0000-0000-000000000001",
    })
  )

  assert.equal(response.status, 200)
  assert.equal(exportCalls, 1)
})

test("protected POST rejects unauthorised, cross-origin and malformed requests", async () => {
  let exportCalls = 0
  const unauthorised = await exportPost({
    authorise: async () => {
      throw new Error("fixture auth detail")
    },
  })(exportRequest())
  const crossOrigin = await exportPost({ sameOrigin: () => false })(
    exportRequest()
  )
  const malformed = await exportPost({
    exportCustomer: async () => {
      exportCalls += 1
      return { data: EXPORT, error: null }
    },
  })(exportRequest({ customerId: "missing" }))

  assert.equal(unauthorised.status, 403)
  assert.equal(crossOrigin.status, 403)
  assert.equal(malformed.status, 400)
  assert.equal(exportCalls, 0)
  assert.doesNotMatch(await unauthorised.text(), /fixture auth detail/)
})

test("protected POST withholds empty and failed exports without false success", async () => {
  const empty = await exportPost({
    exportCustomer: async () => ({ data: {}, error: null }),
  })(exportRequest())
  const failed = await exportPost({
    exportCustomer: async () => ({
      data: null,
      error: { message: "private database detail" },
    }),
  })(exportRequest())

  assert.equal(empty.status, 422)
  assert.equal(failed.status, 503)
  assert.equal(empty.headers.has("content-disposition"), false)
  assert.equal(failed.headers.has("content-disposition"), false)
  assert.doesNotMatch(await failed.text(), /private database detail/)
})

test("cancelled stream leaves no replay state and a fresh POST is complete", async () => {
  const post = exportPost()
  const cancelled = await post(exportRequest())
  const reader = cancelled.body?.getReader()
  assert.ok(reader)
  await reader.cancel()

  const fresh = await post(exportRequest())
  assert.equal(fresh.status, 200)
  assert.deepEqual(JSON.parse(await fresh.text()), EXPORT)
})

test("production route uses the authenticated user session for the guarded RPC", async () => {
  const source = await readFile(
    new URL("../../app/admin/privacy/export/route.ts", import.meta.url),
    "utf8"
  )

  assert.match(source, /createSupabaseServerClient/)
  assert.doesNotMatch(source, /createSupabaseServiceRoleClient/)
})
