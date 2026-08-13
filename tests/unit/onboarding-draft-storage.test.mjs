import assert from "node:assert/strict"
import { test } from "node:test"

import {
  clearCompletedMerchantOnboardingDraft,
  clearErasedMerchantOnboardingDraft,
  clearMerchantOnboardingDraft,
  markMerchantOnboardingCompletionPending,
  merchantOnboardingDraftStorageKey,
  readMerchantOnboardingDraft,
  writeMerchantOnboardingDraft,
} from "@/lib/merchant/onboarding-draft-storage"

const NOW = 1_800_000_000_000
const ACCOUNT_ID = "account-current"
const OTHER_ACCOUNT_ID = "account-other"
const PREFERENCE_KEY = "nabaperks:preference:theme"
const PREFERENCE_VALUE = "paper"

function createStorage() {
  const values = new Map()

  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

test("Given finite draft fields When they are written and read Then the account envelope restores only those fields", () => {
  const storage = createStorage()

  assert.equal(
    writeMerchantOnboardingDraft(
      storage,
      ACCOUNT_ID,
      {
        addressCity: "Synthetic city",
        addressPostcode: "ZZ1 1ZZ",
      },
      NOW
    ),
    true
  )
  assert.deepEqual(readMerchantOnboardingDraft(storage, ACCOUNT_ID, NOW), {
    addressCity: "Synthetic city",
    addressPostcode: "ZZ1 1ZZ",
  })
})

test("Given a same-account legacy raw draft When it is read Then it restores and is rewritten as a current envelope", () => {
  const storage = createStorage()
  const draftKey = merchantOnboardingDraftStorageKey(ACCOUNT_ID)
  storage.setItem(
    draftKey,
    JSON.stringify({
      addressCity: "Synthetic city",
      addressPostcode: "ZZ1 1ZZ",
    })
  )

  assert.deepEqual(readMerchantOnboardingDraft(storage, ACCOUNT_ID, NOW), {
    addressCity: "Synthetic city",
    addressPostcode: "ZZ1 1ZZ",
  })
  assert.deepEqual(JSON.parse(storage.getItem(draftKey)), {
    accountId: ACCOUNT_ID,
    fields: {
      addressCity: "Synthetic city",
      addressPostcode: "ZZ1 1ZZ",
    },
    savedAt: NOW,
    version: 1,
  })
})

test("Given expired and wrong-account envelopes When each is read Then it is removed and never returned", () => {
  const storage = createStorage()
  const draftKey = merchantOnboardingDraftStorageKey(ACCOUNT_ID)

  for (const envelope of [
    {
      accountId: ACCOUNT_ID,
      fields: { addressCity: "Expired city" },
      savedAt: NOW - 86_400_001,
      version: 1,
    },
    {
      accountId: OTHER_ACCOUNT_ID,
      fields: { addressCity: "Other city" },
      savedAt: NOW,
      version: 1,
    },
  ]) {
    storage.setItem(draftKey, JSON.stringify(envelope))

    assert.deepEqual(readMerchantOnboardingDraft(storage, ACCOUNT_ID, NOW), {})
    assert.equal(storage.getItem(draftKey), null)
  }
})

test("Given malformed and schema-invalid values When each is read Then it is removed", () => {
  const storage = createStorage()
  const draftKey = merchantOnboardingDraftStorageKey(ACCOUNT_ID)

  for (const value of [
    "not-json",
    JSON.stringify({
      accountId: ACCOUNT_ID,
      fields: { unknownField: "unexpected" },
      savedAt: NOW,
      version: 1,
    }),
  ]) {
    storage.setItem(draftKey, value)

    assert.deepEqual(readMerchantOnboardingDraft(storage, ACCOUNT_ID, NOW), {})
    assert.equal(storage.getItem(draftKey), null)
  }
})

test("Given a draft and unrelated preference When active-account cleanup repeats Then only the draft is absent", () => {
  const storage = createStorage()
  const draftKey = merchantOnboardingDraftStorageKey(ACCOUNT_ID)
  storage.setItem(PREFERENCE_KEY, PREFERENCE_VALUE)
  storage.setItem(draftKey, "synthetic-draft")

  assert.equal(clearMerchantOnboardingDraft(storage, ACCOUNT_ID), true)
  assert.equal(clearMerchantOnboardingDraft(storage, ACCOUNT_ID), true)
  assert.equal(storage.getItem(draftKey), null)
  assert.equal(storage.getItem(PREFERENCE_KEY), PREFERENCE_VALUE)
})

test("Given a draft without a successful-submit marker When completion cleanup runs Then the draft remains", () => {
  const localStorage = createStorage()
  const sessionStorage = createStorage()
  const draftKey = merchantOnboardingDraftStorageKey(ACCOUNT_ID)
  localStorage.setItem(draftKey, "synthetic-draft")

  assert.equal(
    clearCompletedMerchantOnboardingDraft(localStorage, sessionStorage),
    false
  )
  assert.equal(localStorage.getItem(draftKey), "synthetic-draft")
})

test("Given matching active and successful-submit markers When completion cleanup runs Then only that draft is removed", () => {
  const localStorage = createStorage()
  const sessionStorage = createStorage()
  const draftKey = merchantOnboardingDraftStorageKey(ACCOUNT_ID)
  localStorage.setItem(draftKey, "synthetic-draft")
  sessionStorage.setItem(
    "nabaperks:onboarding-draft:active-account",
    ACCOUNT_ID
  )
  markMerchantOnboardingCompletionPending(sessionStorage, ACCOUNT_ID)

  assert.equal(
    clearCompletedMerchantOnboardingDraft(localStorage, sessionStorage),
    true
  )
  assert.equal(localStorage.getItem(draftKey), null)
})

test("Given a completed erasure for the active account When cleanup runs Then only its draft is removed", () => {
  const localStorage = createStorage()
  const sessionStorage = createStorage()
  const draftKey = merchantOnboardingDraftStorageKey(ACCOUNT_ID)
  localStorage.setItem(draftKey, "synthetic-draft")
  localStorage.setItem(PREFERENCE_KEY, PREFERENCE_VALUE)
  sessionStorage.setItem(
    "nabaperks:onboarding-draft:active-account",
    ACCOUNT_ID
  )

  assert.equal(
    clearErasedMerchantOnboardingDraft(
      localStorage,
      sessionStorage,
      ACCOUNT_ID
    ),
    true
  )
  assert.equal(localStorage.getItem(draftKey), null)
  assert.equal(localStorage.getItem(PREFERENCE_KEY), PREFERENCE_VALUE)
})

test("Given a different-account erasure When cleanup runs Then the active draft remains", () => {
  const localStorage = createStorage()
  const sessionStorage = createStorage()
  const draftKey = merchantOnboardingDraftStorageKey(ACCOUNT_ID)
  localStorage.setItem(draftKey, "synthetic-draft")
  sessionStorage.setItem(
    "nabaperks:onboarding-draft:active-account",
    ACCOUNT_ID
  )

  assert.equal(
    clearErasedMerchantOnboardingDraft(
      localStorage,
      sessionStorage,
      OTHER_ACCOUNT_ID
    ),
    false
  )
  assert.equal(localStorage.getItem(draftKey), "synthetic-draft")
})
