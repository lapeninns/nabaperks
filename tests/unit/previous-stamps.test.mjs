import assert from "node:assert/strict"
import { test } from "node:test"

import {
  CONTACT_NOTICE_COPY,
  PREVIOUS_STAMPS_COPY,
  contactNoticeBacked,
  contactNoticeReturn,
  isContactNotice,
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

test("Given a returnTo When a notice is sent back Then the redirect keeps its query and hash, carries no flag, and names the path it is bound to", () => {
  assert.deepEqual(contactNoticeReturn("/reward/r-1?prepare=1"), {
    href: "/reward/r-1?prepare=1",
    pathname: "/reward/r-1",
  })
  assert.deepEqual(contactNoticeReturn("/home/profile#previous-stamps"), {
    href: "/home/profile#previous-stamps",
    pathname: "/home/profile",
  })
  assert.deepEqual(contactNoticeReturn("https://evil.example/x"), {
    href: "/home/profile",
    pathname: "/home/profile",
  })
  assert.equal(isContactNotice("stamps-together"), true)
  assert.equal(isContactNotice("other"), false)
  assert.equal(isContactNotice(undefined), false)
})

test("Given a notice the server state does not back When it is checked Then it is not shown", () => {
  const none = { phone: false, email: false }
  const phoneOnly = { phone: true, email: false }
  const emailOnly = { phone: false, email: true }
  for (const notice of Object.keys(CONTACT_NOTICE_COPY)) {
    assert.equal(contactNoticeBacked(notice, none), false, notice)
  }
  assert.equal(contactNoticeBacked("phone-added", emailOnly), false)
  assert.equal(contactNoticeBacked("nothing-found-phone", emailOnly), false)
  assert.equal(contactNoticeBacked("nothing-found-email", phoneOnly), false)
  assert.equal(contactNoticeBacked("phone-added", phoneOnly), true)
  assert.equal(contactNoticeBacked("stamps-together", emailOnly), true)
})
