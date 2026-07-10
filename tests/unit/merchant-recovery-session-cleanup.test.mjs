import assert from "node:assert/strict"
import { test } from "node:test"

import { cleanupFailedMerchantRecoverySession } from "@/lib/auth/merchant-recovery-session-cleanup"

const ACCESS_TOKEN = "sensitive-recovery-access-token"

test("local revocation success skips the admin fallback and clears browser credentials", async () => {
  const calls = []

  const result = await cleanupFailedMerchantRecoverySession(ACCESS_TOKEN, {
    signOutLocal: async (...args) => {
      calls.push(["local", args])
      return { error: null }
    },
    signOutAdminLocal: async (...args) => {
      calls.push(["admin", args])
      return { error: null }
    },
    clearBrowserCredentials: async (...args) => {
      calls.push(["clear", args])
    },
    onSafeFailure: (...args) => calls.push(["failure", args]),
  })

  assert.deepEqual(result, {
    revocation: "local",
    browserCredentialsCleared: true,
  })
  assert.deepEqual(calls, [
    ["local", []],
    ["clear", []],
  ])
})

test("a returned local error uses the admin local fallback", async () => {
  const failures = []
  const adminTokens = []
  let browserClearCalls = 0

  const result = await cleanupFailedMerchantRecoverySession(ACCESS_TOKEN, {
    signOutLocal: async () => ({ error: new Error(ACCESS_TOKEN) }),
    signOutAdminLocal: async (accessToken) => {
      adminTokens.push(accessToken)
      return { error: null }
    },
    clearBrowserCredentials: async () => {
      browserClearCalls += 1
    },
    onSafeFailure: (failure) => failures.push(failure),
  })

  assert.deepEqual(result, {
    revocation: "admin",
    browserCredentialsCleared: true,
  })
  assert.deepEqual(adminTokens, [ACCESS_TOKEN])
  assert.equal(browserClearCalls, 1)
  assert.deepEqual(failures, [
    { phase: "local-revocation", kind: "returned-error" },
  ])
  assert.doesNotMatch(JSON.stringify({ result, failures }), /sensitive/)
})

test("a thrown local error uses the admin local fallback", async () => {
  const failures = []

  const result = await cleanupFailedMerchantRecoverySession(ACCESS_TOKEN, {
    signOutLocal: async () => {
      throw new Error(ACCESS_TOKEN)
    },
    signOutAdminLocal: async () => ({ error: null }),
    clearBrowserCredentials: async () => {},
    onSafeFailure: (failure) => failures.push(failure),
  })

  assert.equal(result.revocation, "admin")
  assert.deepEqual(failures, [{ phase: "local-revocation", kind: "threw" }])
})

test("browser credentials are still cleared when both revocations fail", async () => {
  const failures = []
  let browserClearCalls = 0

  const result = await cleanupFailedMerchantRecoverySession(ACCESS_TOKEN, {
    signOutLocal: async () => ({ error: new Error("local failed") }),
    signOutAdminLocal: async () => {
      throw new Error("admin failed")
    },
    clearBrowserCredentials: async () => {
      browserClearCalls += 1
    },
    onSafeFailure: (failure) => failures.push(failure),
  })

  assert.deepEqual(result, {
    revocation: "unconfirmed",
    browserCredentialsCleared: true,
  })
  assert.equal(browserClearCalls, 1)
  assert.deepEqual(failures, [
    { phase: "local-revocation", kind: "returned-error" },
    { phase: "admin-revocation", kind: "threw" },
  ])
})

test("browser credential clearing failure throws fixed safe copy", async () => {
  const failures = []

  await assert.rejects(
    cleanupFailedMerchantRecoverySession(ACCESS_TOKEN, {
      signOutLocal: async () => ({ error: null }),
      signOutAdminLocal: async () => {
        throw new Error("admin must not run")
      },
      clearBrowserCredentials: async () => {
        throw new Error(ACCESS_TOKEN)
      },
      onSafeFailure: (failure) => failures.push(failure),
    }),
    (error) => {
      assert.equal(
        error.message,
        "Unable to close the failed password-reset session safely."
      )
      assert.doesNotMatch(error.message, /sensitive/)
      return true
    }
  )

  assert.deepEqual(failures, [{ phase: "browser-clear", kind: "threw" }])
})

test("only the admin fallback receives the access token", async () => {
  const receivedArguments = {
    local: [],
    admin: [],
    clear: [],
    failure: [],
  }

  const result = await cleanupFailedMerchantRecoverySession(ACCESS_TOKEN, {
    signOutLocal: async (...args) => {
      receivedArguments.local.push(args)
      throw new Error("local failed")
    },
    signOutAdminLocal: async (...args) => {
      receivedArguments.admin.push(args)
      return { error: null }
    },
    clearBrowserCredentials: async (...args) => {
      receivedArguments.clear.push(args)
    },
    onSafeFailure: (...args) => receivedArguments.failure.push(args),
  })

  assert.equal(result.revocation, "admin")
  assert.deepEqual(receivedArguments.local, [[]])
  assert.deepEqual(receivedArguments.admin, [[ACCESS_TOKEN]])
  assert.deepEqual(receivedArguments.clear, [[]])
  assert.deepEqual(receivedArguments.failure, [
    [{ phase: "local-revocation", kind: "threw" }],
  ])
  assert.doesNotMatch(
    JSON.stringify({
      result,
      local: receivedArguments.local,
      clear: receivedArguments.clear,
      failure: receivedArguments.failure,
    }),
    /sensitive/
  )
})

test("a diagnostic callback failure cannot interrupt browser credential clearing", async () => {
  let browserClearCalls = 0

  const result = await cleanupFailedMerchantRecoverySession(ACCESS_TOKEN, {
    signOutLocal: async () => ({ error: new Error("local failed") }),
    signOutAdminLocal: async () => ({ error: new Error("admin failed") }),
    clearBrowserCredentials: async () => {
      browserClearCalls += 1
    },
    onSafeFailure: () => {
      throw new Error("diagnostics unavailable")
    },
  })

  assert.equal(result.revocation, "unconfirmed")
  assert.equal(browserClearCalls, 1)
})
