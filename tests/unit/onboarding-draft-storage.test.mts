import assert from "node:assert/strict"
import { test } from "node:test"

import {
  clearOnboardingDraft,
  onboardingDraftStorageKey,
  readOnboardingDraft,
  saveOnboardingDraft,
} from "../../lib/merchant/onboarding-draft-storage.ts"

class InMemoryStorage implements Storage {
  readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

test("Given valid account draft fields When the draft is saved Then only that account can resume them", () => {
  const storage = new InMemoryStorage()
  const accountId = "account-a"
  const now = 1_000_000

  saveOnboardingDraft(storage, accountId, { addressCity: "Fixture town" }, now)

  assert.deepEqual(readOnboardingDraft(storage, accountId, now), {
    addressCity: "Fixture town",
  })
})

test("Given malformed or expired account drafts When a draft is read Then the active key is removed", () => {
  const storage = new InMemoryStorage()
  const accountId = "account-a"
  const key = onboardingDraftStorageKey(accountId)
  const now = 2_000_000

  storage.setItem(key, "{")
  assert.equal(readOnboardingDraft(storage, accountId, now), null)
  assert.equal(storage.getItem(key), null)

  saveOnboardingDraft(
    storage,
    accountId,
    { addressCity: "Fixture town" },
    now - 86_400_000
  )
  assert.equal(readOnboardingDraft(storage, accountId, now), null)
  assert.equal(storage.getItem(key), null)
})

test("Given a different account's draft at the active key When a draft is read Then it is removed without resuming", () => {
  const storage = new InMemoryStorage()
  const activeAccountId = "account-a"
  const key = onboardingDraftStorageKey(activeAccountId)
  const now = 3_000_000

  storage.setItem(
    key,
    JSON.stringify({
      version: 1,
      accountId: "account-b",
      savedAt: now,
      fields: { addressCity: "Other fixture" },
    })
  )

  assert.equal(readOnboardingDraft(storage, activeAccountId, now), null)
  assert.equal(storage.getItem(key), null)
})

test("Given an active account draft When completion or logout cleanup repeats Then the account key remains absent", () => {
  const storage = new InMemoryStorage()
  const accountId = "account-a"
  const now = 4_000_000

  saveOnboardingDraft(storage, accountId, { addressCity: "Fixture town" }, now)
  clearOnboardingDraft(storage, accountId)
  clearOnboardingDraft(storage, accountId)

  assert.equal(storage.getItem(onboardingDraftStorageKey(accountId)), null)
})
