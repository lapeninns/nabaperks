import assert from "node:assert/strict"
import { test } from "node:test"

import {
  HOME_SETUP_SUGGESTION_COPY,
  HOME_SETUP_SUGGESTION_RESHOW_AFTER_MS,
  homeSetupSuggestionCandidates,
  pickHomeSetupSuggestion,
  suggestionDismissalActive,
} from "@/lib/customer/home-setup-suggestion"

function facts(overrides = {}) {
  return {
    cardCount: 1,
    rewardNeedsSetup: false,
    hasConfirmedPhone: true,
    hasConfirmedEmail: true,
    hasBirthday: true,
    ...overrides,
  }
}

test("an empty home offers no setup suggestion, only the scan action", () => {
  assert.deepEqual(
    homeSetupSuggestionCandidates(
      facts({
        cardCount: 0,
        hasConfirmedPhone: false,
        hasConfirmedEmail: false,
        hasBirthday: false,
      })
    ),
    []
  )
})

test("a reward needing setup owns the slot through its own action", () => {
  assert.deepEqual(
    homeSetupSuggestionCandidates(
      facts({
        rewardNeedsSetup: true,
        hasConfirmedPhone: false,
        hasBirthday: false,
      })
    ),
    []
  )
})

test("candidates follow the brief's priority: phone, previous stamps, email, birthday", () => {
  // Joined by email: a mobile number first, then finding stamps saved to one.
  assert.deepEqual(
    homeSetupSuggestionCandidates(
      facts({ hasConfirmedPhone: false, hasBirthday: false })
    ),
    ["phone", "previous_stamps", "birthday"]
  )
  // Joined by phone, nothing else saved.
  assert.deepEqual(
    homeSetupSuggestionCandidates(
      facts({ hasConfirmedEmail: false, hasBirthday: false })
    ),
    ["email", "birthday"]
  )
  // No confirmed contact at all: previous stamps is not offered, since only
  // a guest who joined without a number can have stamps under one.
  assert.deepEqual(
    homeSetupSuggestionCandidates(
      facts({ hasConfirmedPhone: false, hasConfirmedEmail: false })
    ),
    ["phone", "email"]
  )
  assert.deepEqual(homeSetupSuggestionCandidates(facts()), [])
})

test("exactly one suggestion is picked, skipping the ones set aside", () => {
  const candidates = ["phone", "previous_stamps", "email", "birthday"]

  assert.equal(pickHomeSetupSuggestion(candidates, []), "phone")
  assert.equal(
    pickHomeSetupSuggestion(candidates, ["phone"]),
    "previous_stamps"
  )
  assert.equal(
    pickHomeSetupSuggestion(candidates, ["phone", "previous_stamps"]),
    "email"
  )
  assert.equal(
    pickHomeSetupSuggestion(candidates, [
      "phone",
      "previous_stamps",
      "email",
      "birthday",
    ]),
    null
  )
  assert.equal(pickHomeSetupSuggestion([], ["phone"]), null)
})

test("a dismissal lapses after thirty days and malformed values never hide", () => {
  const now = Date.parse("2026-09-30T12:00:00Z")
  assert.equal(suggestionDismissalActive(null, now), false)
  assert.equal(suggestionDismissalActive("not-a-number", now), false)
  assert.equal(suggestionDismissalActive(String(now - 1000), now), true)
  assert.equal(
    suggestionDismissalActive(
      String(now - HOME_SETUP_SUGGESTION_RESHOW_AFTER_MS - 1),
      now
    ),
    false
  )
})

test("suggestion copy is plain guest English with no internal vocabulary", () => {
  assert.equal(HOME_SETUP_SUGGESTION_COPY.phone.title, "Add your mobile number")
  assert.equal(
    HOME_SETUP_SUGGESTION_COPY.phone.body,
    "You'll need it to collect rewards."
  )
  assert.equal(
    HOME_SETUP_SUGGESTION_COPY.previous_stamps.title,
    "Find my previous stamps"
  )
  for (const copy of Object.values(HOME_SETUP_SUGGESTION_COPY)) {
    for (const line of [copy.title, copy.body, copy.action]) {
      assert.doesNotMatch(
        line,
        /wallet|verif|lock|link|continuity|trading day|!|—/i
      )
    }
  }
})

test("each suggestion opens the profile task it names", async () => {
  const { PREVIOUS_STAMPS_RETURN_TO } =
    await import("@/lib/customer/previous-stamps")
  assert.equal(HOME_SETUP_SUGGESTION_COPY.phone.href, "/home/profile#add-phone")
  // "Find my previous stamps" lands on that task, not the contact number field.
  assert.equal(
    HOME_SETUP_SUGGESTION_COPY.previous_stamps.href,
    PREVIOUS_STAMPS_RETURN_TO
  )
})
