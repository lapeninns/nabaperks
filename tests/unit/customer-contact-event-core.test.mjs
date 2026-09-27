import assert from "node:assert/strict"
import { test } from "node:test"

import {
  CUSTOMER_CONTACT_EVENT_NAMES,
  contactEventMetadata,
  isClientEmailPromptEvent,
  isCustomerContactEventName,
  isEmailPromptSurface,
} from "@/lib/customer/contact-event-core"

const EMAIL = "guest@example.test"
const PHONE = "+447700900123"

test("contact event metadata keeps only method, surface and reason from their fixed sets", () => {
  assert.deepEqual(
    contactEventMetadata({
      method: "email",
      surface: "home_prompt",
      reason: "email_in_use",
    }),
    { method: "email", surface: "home_prompt", reason: "email_in_use" }
  )
  assert.deepEqual(contactEventMetadata({ method: "phone" }), {
    method: "phone",
  })
  for (const input of [null, undefined, "email", 42, []]) {
    assert.deepEqual(contactEventMetadata(input), {})
  }
})

test("contact event metadata never carries an email, phone number, code or free text", () => {
  const metadata = contactEventMetadata({
    method: EMAIL,
    surface: PHONE,
    reason: "123456",
    email: EMAIL,
    phone: PHONE,
    code: "123456",
    contact: EMAIL,
    note: "anything",
  })

  assert.deepEqual(metadata, {})
  const serialized = JSON.stringify(
    contactEventMetadata({
      method: "email",
      surface: "join",
      reason: "provider_unavailable",
      email: EMAIL,
      phone: PHONE,
    })
  )
  assert.doesNotMatch(serialized, /@|\+44|\d{4}/)
  assert.deepEqual(Object.keys(JSON.parse(serialized)).sort(), [
    "method",
    "reason",
    "surface",
  ])
})

test("the contact vocabulary names ten events and only two may come from a browser", () => {
  assert.equal(CUSTOMER_CONTACT_EVENT_NAMES.length, 10)
  assert.equal(new Set(CUSTOMER_CONTACT_EVENT_NAMES).size, 10)
  for (const name of CUSTOMER_CONTACT_EVENT_NAMES) {
    assert.equal(isCustomerContactEventName(name), true, name)
  }
  assert.equal(isCustomerContactEventName("customer_joined"), false)

  assert.equal(isClientEmailPromptEvent("customer_email_prompt_viewed"), true)
  assert.equal(
    isClientEmailPromptEvent("customer_email_prompt_dismissed"),
    true
  )
  for (const forged of [
    "customer_email_verified",
    "customer_contact_conflict",
    "join_code_send_failed",
    { toString: () => "customer_email_prompt_viewed" },
  ]) {
    assert.equal(isClientEmailPromptEvent(forged), false)
  }

  assert.equal(isEmailPromptSurface("home_prompt"), true)
  assert.equal(isEmailPromptSurface("stamp_prompt"), true)
  assert.equal(isEmailPromptSurface("profile"), false)
  assert.equal(isEmailPromptSurface(EMAIL), false)
})
