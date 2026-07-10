import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildExportDownload,
  buildExportFilename,
  isCustomerDataExport,
  serializeExport,
} from "@/lib/admin/data-export"

/**
 * MS-db-privacy-lifecycle — pure helpers that turn the `admin_export_customer_data`
 * RPC payload into a downloadable file. No IO: the server action and the client
 * form consume these shapes.
 */

const EXPORT = {
  schema: "nabaperks.customer-data-export.v1",
  generated_at: "2026-07-10T09:41:00.000Z",
  customer: { id: "11111111-2222-3333-4444-555555555555", email: "e***@x.io" },
  memberships: [],
  stamp_events: [],
}

const ACCESS_LOG = { ok: true, request_type: "access", manual_follow_up_required: true }
const DELETION = { ok: true, request_type: "deletion", ledger_retained: true }

test("isCustomerDataExport accepts an export payload and rejects everything else", () => {
  assert.equal(isCustomerDataExport(EXPORT), true)
  assert.equal(isCustomerDataExport(ACCESS_LOG), false)
  assert.equal(isCustomerDataExport(DELETION), false)
  assert.equal(isCustomerDataExport(null), false)
  assert.equal(isCustomerDataExport(undefined), false)
  assert.equal(isCustomerDataExport("nope"), false)
  assert.equal(isCustomerDataExport({ schema: "nabaperks.customer-data-export.v1" }), false)
})

test("buildExportFilename names the file for the customer and export date", () => {
  assert.equal(
    buildExportFilename(EXPORT),
    "customer-data-export-11111111-2222-3333-4444-555555555555-2026-07-10.json"
  )
})

test("serializeExport pretty-prints the exact payload", () => {
  const serialized = serializeExport(EXPORT)
  assert.deepEqual(JSON.parse(serialized), EXPORT)
  assert.ok(serialized.includes("\n"), "output is pretty-printed")
})

test("buildExportDownload returns a JSON descriptor only for an export payload", () => {
  const download = buildExportDownload(EXPORT)
  assert.ok(download, "an export yields a download descriptor")
  assert.equal(download.mimeType, "application/json")
  assert.equal(
    download.filename,
    "customer-data-export-11111111-2222-3333-4444-555555555555-2026-07-10.json"
  )
  assert.deepEqual(JSON.parse(download.content), EXPORT)

  assert.equal(buildExportDownload(ACCESS_LOG), null)
  assert.equal(buildExportDownload(DELETION), null)
  assert.equal(buildExportDownload(null), null)
})
