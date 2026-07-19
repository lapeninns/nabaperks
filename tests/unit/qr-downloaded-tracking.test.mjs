import assert from "node:assert/strict"
import { test } from "node:test"

import {
  POSTER_DOWNLOAD_ASSET_TYPE,
  buildQrPosterDownloadEvent,
} from "@/app/app/qr/poster/tracking"

/**
 * analytics qr downloaded wire — the qr_downloaded event contract.
 *
 * Four surfaces already read this event (dashboard period counts, activity
 * feed, pilot report, analytics registry) but nothing wrote it — the metric
 * was permanently zero. These tests pin the pure event builder the poster
 * print action records through, including the activity-feed metadata contract
 * (`metadata.asset_type`, formatted by lib/merchant/activity.ts).
 */

const MERCHANT_ID = "11111111-1111-1111-1111-111111111111"
const QR_CODE_ID = "22222222-2222-2222-2222-222222222222"

test("poster print builds exactly the registered qr_downloaded event", () => {
  const event = buildQrPosterDownloadEvent({
    merchantId: MERCHANT_ID,
    qrCodeId: QR_CODE_ID,
    templateId: "window",
  })

  assert.equal(
    event.eventName,
    "qr_downloaded",
    "the registered event name is used"
  )
  assert.equal(
    event.merchantId,
    MERCHANT_ID,
    "the event is attributed to the acting merchant"
  )
  assert.equal(event.actorType, "merchant", "the actor is the merchant")
  assert.equal(event.actorId, MERCHANT_ID, "the actor id is the merchant id")
  assert.equal(event.qrCodeId, QR_CODE_ID, "the poster's QR code is attached")
})

test("the activity-feed metadata contract is satisfied", () => {
  const event = buildQrPosterDownloadEvent({
    merchantId: MERCHANT_ID,
    qrCodeId: QR_CODE_ID,
    templateId: "lastcall",
  })

  assert.equal(
    event.metadata.asset_type,
    POSTER_DOWNLOAD_ASSET_TYPE,
    "asset_type is present for the activity feed's formatAssetType"
  )
  assert.equal(
    event.metadata.asset_type,
    "poster_pdf",
    "poster prints map to poster_pdf"
  )
  assert.equal(
    event.metadata.template,
    "lastcall",
    "the template id is preserved for analysis"
  )
})

test("a poster without a resolvable QR still records with null qr_code_id", () => {
  const event = buildQrPosterDownloadEvent({
    merchantId: MERCHANT_ID,
    qrCodeId: null,
    templateId: "receipt",
  })

  assert.equal(
    event.qrCodeId,
    null,
    "qr_code_id is null, not undefined or fabricated"
  )
  assert.equal(event.eventName, "qr_downloaded", "the event still records")
})
