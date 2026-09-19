import assert from "node:assert/strict"
import { test } from "node:test"

import { resolvePhoneMarketingConsent } from "@/lib/notifications/phone-marketing-consent-core"

test("legacy SMS opt-in covers both phone channels until an explicit channel choice exists", () => {
  assert.deepEqual(
    resolvePhoneMarketingConsent([
      { channel: "sms", consent_status: "opted_in", created_at: "2026-01-01" },
    ]),
    { whatsapp: true, sms: true }
  )
})

test("explicit opt-out wins for its channel and does not manufacture another opt-in", () => {
  assert.deepEqual(
    resolvePhoneMarketingConsent([
      { channel: "sms", consent_status: "opted_in", created_at: "2026-01-01" },
      {
        channel: "whatsapp",
        consent_status: "opted_out",
        created_at: "2026-01-02",
      },
    ]),
    { whatsapp: false, sms: true }
  )
})

test("STOP rows on both channels supersede historical opt-ins", () => {
  assert.deepEqual(
    resolvePhoneMarketingConsent([
      { channel: "sms", consent_status: "opted_in", created_at: "2026-01-01" },
      { channel: "sms", consent_status: "opted_out", created_at: "2026-01-03" },
      {
        channel: "whatsapp",
        consent_status: "opted_out",
        created_at: "2026-01-03",
      },
    ]),
    { whatsapp: false, sms: false }
  )
})
