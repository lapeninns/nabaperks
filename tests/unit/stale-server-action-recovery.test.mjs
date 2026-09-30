import assert from "node:assert/strict"
import { test } from "node:test"

import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error.js"

import {
  STALE_ACTION_RELOAD_KEY,
  isStaleServerActionError,
  recoverFromBoundaryError,
} from "@/lib/navigation/stale-server-action"

/**
 * QA BUG-062 (38c42a1..2c45031): a tab rendered by one production build posts
 * server-action IDs the next build does not know. Next answers 404 with
 * x-nextjs-action-not-found and the client throws UnrecognizedActionError
 * into the nearest error boundary. reset() re-renders with the same stale
 * bundle, so every retry failed again and a stale "Log out" left the session
 * live. "Try again" must load the page afresh for that error, once.
 */

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    values,
  }
}

function recorder({ now = 1_000_000, storage = memoryStorage() } = {}) {
  const calls = []
  return {
    calls,
    storage,
    env: {
      now: () => now,
      storage,
      reload: () => calls.push("reload"),
    },
    reset: () => calls.push("reset"),
  }
}

// The exact error Next 16 throws for an unknown action ID (server-action-reducer).
function nextUnknownActionError() {
  return Object.defineProperty(
    new UnrecognizedActionError(
      'Server Action "7f3a" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action'
    ),
    "__NEXT_ERROR_CODE",
    { value: "E715", enumerable: false }
  )
}

test("recognises Next's unknown server action error and the server's wording", () => {
  assert.equal(isStaleServerActionError(nextUnknownActionError()), true)
  assert.equal(
    isStaleServerActionError(
      new Error(
        'Failed to find Server Action "7f3a". This request might be from an older or newer deployment.'
      )
    ),
    true
  )
  const withCodeOnly = Object.defineProperty(
    new Error("x"),
    "__NEXT_ERROR_CODE",
    {
      value: "E715",
    }
  )
  assert.equal(isStaleServerActionError(withCodeOnly), true)
})

test("leaves every other error to the normal retry", () => {
  for (const error of [
    new Error("That didn't load"),
    new TypeError("fetch failed"),
    Object.assign(
      new Error("An error occurred in the Server Components render"),
      {
        digest: "12345",
      }
    ),
    null,
    undefined,
    "Server Action",
  ]) {
    assert.equal(isStaleServerActionError(error), false, String(error))
  }
})

test("Try again reloads the page for a stale server action instead of re-rendering the stale bundle", () => {
  const r = recorder()
  recoverFromBoundaryError(nextUnknownActionError(), r.reset, r.env)
  assert.deepEqual(r.calls, ["reload"])
  assert.equal(r.storage.getItem(STALE_ACTION_RELOAD_KEY), "1000000")
})

test("Try again keeps reset() for any other error", () => {
  const r = recorder()
  recoverFromBoundaryError(new Error("render failed"), r.reset, r.env)
  assert.deepEqual(r.calls, ["reset"])
  assert.equal(r.storage.getItem(STALE_ACTION_RELOAD_KEY), null)
})

test("a second stale action straight after a reload falls back to reset() instead of looping", () => {
  const storage = memoryStorage()
  storage.setItem(STALE_ACTION_RELOAD_KEY, "990000")
  const r = recorder({ now: 1_000_000, storage })
  recoverFromBoundaryError(nextUnknownActionError(), r.reset, r.env)
  assert.deepEqual(r.calls, ["reset"])
})

test("an older reload does not block a new recovery", () => {
  const storage = memoryStorage()
  storage.setItem(STALE_ACTION_RELOAD_KEY, "100000")
  const r = recorder({ now: 1_000_000, storage })
  recoverFromBoundaryError(nextUnknownActionError(), r.reset, r.env)
  assert.deepEqual(r.calls, ["reload"])
})

test("unavailable session storage still reloads once", () => {
  const throwing = {
    getItem() {
      throw new Error("SecurityError")
    },
    setItem() {
      throw new Error("SecurityError")
    },
  }
  const r = recorder({ storage: throwing })
  recoverFromBoundaryError(nextUnknownActionError(), r.reset, r.env)
  assert.deepEqual(r.calls, ["reload"])
})
