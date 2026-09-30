import assert from "node:assert/strict"
import { test } from "node:test"

import {
  CONTACT_NOTICE_COPY,
  PREVIOUS_STAMPS_COPY,
  contactNoticeFromParam,
  contactNoticeHref,
  previousStampsMethod,
  walletLinkFailureCopy,
  walletLinkReturnTo,
  walletLinkedMessage,
} from "@/lib/customer/previous-stamps"

/**
 * "Find my previous stamps" (brief section W): which contact the task asks
 * for, the outcome copy, and where "Sign in again" and notices return to.
 */

test("Given what a card has confirmed When the task is chosen Then it asks for the missing contact, or staff when nothing can link", () => {
  assert.equal(
    previousStampsMethod({ phoneVerified: false, emailVerified: true }),
    "phone"
  )
  assert.equal(
    previousStampsMethod({ phoneVerified: false, emailVerified: false }),
    "phone"
  )
  assert.equal(
    previousStampsMethod({ phoneVerified: true, emailVerified: false }),
    "email"
  )
  assert.equal(
    previousStampsMethod({ phoneVerified: true, emailVerified: true }),
    "staff"
  )
})

test("Given cards brought together When the copy is chosen Then email is mentioned only while the fallback is on, never as a way in", () => {
  const off = walletLinkedMessage(false)
  assert.equal(
    off,
    "Your stamps are together now. Sign in with your mobile number."
  )
  assert.doesNotMatch(off, /email/i)
  const on = walletLinkedMessage(true)
  assert.match(
    on,
    /^Your stamps are together now\. Sign in with your mobile number\./
  )
  assert.doesNotMatch(on, /sign in with (your )?email/i)
})

test("Given a refused link When the copy is chosen Then it follows the brief and discloses nothing about the other card", () => {
  assert.equal(
    walletLinkFailureCopy("reauthenticate", "phone"),
    "For your security, sign in again, then confirm the other number."
  )
  assert.equal(
    walletLinkFailureCopy("reauthenticate", "email"),
    "For your security, sign in again, then confirm the other email."
  )
  assert.equal(
    walletLinkFailureCopy("requires_review"),
    "We can't bring these together automatically. Your stamps haven't changed. Ask staff at a venue for help."
  )
  assert.equal(
    walletLinkFailureCopy("conflict", "phone"),
    "This number is used by another card. Sign in with that number, or ask staff for help."
  )
  const emailConflict = walletLinkFailureCopy("conflict", "email")
  assert.doesNotMatch(emailConflict, /sign in with that email/i)
})

test("Given every guest string in the task When it is read Then it has no internal words, emoji, exclamation marks or em dashes", () => {
  const strings = [
    ...Object.values(PREVIOUS_STAMPS_COPY).flatMap((value) =>
      typeof value === "string" ? [value] : Object.values(value)
    ),
    walletLinkedMessage(false),
    walletLinkedMessage(true),
    ...["conflict", "reauthenticate", "requires_review"].flatMap((status) => [
      walletLinkFailureCopy(status, "phone"),
      walletLinkFailureCopy(status, "email"),
    ]),
    ...Object.values(CONTACT_NOTICE_COPY).flatMap(({ title, body }) => [
      title,
      body,
    ]),
  ]
  for (const text of strings) {
    assert.doesNotMatch(
      text,
      /wallet|verif|locked|link|continuity|account|!|—|\p{Extended_Pictographic}/iu,
      text
    )
  }
})

test("Given a returnTo When it is validated Then only a same-origin path survives, defaulting to the profile", () => {
  assert.equal(walletLinkReturnTo(undefined), "/home/profile")
  assert.equal(walletLinkReturnTo(""), "/home/profile")
  assert.equal(walletLinkReturnTo("/reward/r-1"), "/reward/r-1")
  assert.equal(walletLinkReturnTo("/home"), "/home")
  assert.equal(walletLinkReturnTo("https://evil.example/"), "/home/profile")
  assert.equal(walletLinkReturnTo("//evil.example"), "/home/profile")
  assert.equal(walletLinkReturnTo("/home/login?next=/x"), "/home/profile")
})

test("Given a notice When it is added to returnTo and read back Then the query and hash are kept and unknown values show nothing", () => {
  assert.equal(
    contactNoticeHref("/reward/r-1?prepare=1", "phone-added"),
    "/reward/r-1?prepare=1&contact=phone-added"
  )
  assert.equal(
    contactNoticeHref("/home/profile#previous-stamps", "stamps-together"),
    "/home/profile?contact=stamps-together#previous-stamps"
  )
  const both = { phone: true, email: true }
  assert.equal(
    contactNoticeFromParam("stamps-together", both),
    "stamps-together"
  )
  assert.equal(
    contactNoticeFromParam(["nothing-found-email"], both),
    "nothing-found-email"
  )
  assert.equal(contactNoticeFromParam("other", both), null)
  assert.equal(contactNoticeFromParam(undefined, both), null)
})

test("Given a notice flag the server state does not back When it is read Then nothing is shown", () => {
  const none = { phone: false, email: false }
  const phoneOnly = { phone: true, email: false }
  const emailOnly = { phone: false, email: true }
  for (const flag of [
    "phone-added",
    "stamps-together",
    "nothing-found-phone",
    "nothing-found-email",
  ]) {
    assert.equal(contactNoticeFromParam(flag, none), null, flag)
  }
  assert.equal(contactNoticeFromParam("phone-added", emailOnly), null)
  assert.equal(contactNoticeFromParam("nothing-found-phone", emailOnly), null)
  assert.equal(contactNoticeFromParam("nothing-found-email", phoneOnly), null)
  assert.equal(contactNoticeFromParam("phone-added", phoneOnly), "phone-added")
  assert.equal(
    contactNoticeFromParam("stamps-together", emailOnly),
    "stamps-together"
  )
})
