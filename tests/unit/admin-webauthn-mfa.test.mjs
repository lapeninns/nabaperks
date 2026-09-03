import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import {
  registerAdminWebAuthnFactor,
  stepUpAdminWebAuthn,
} from "@/lib/admin/webauthn-mfa"

const originalWindow = globalThis.window
const originalNavigator = globalThis.navigator
const originalPublicKeyCredential = globalThis.PublicKeyCredential

afterEach(() => {
  restoreGlobal("window", originalWindow)
  restoreGlobal("navigator", originalNavigator)
  restoreGlobal("PublicKeyCredential", originalPublicKeyCredential)
})

test("registration requires local user verification and verifies the new factor", async () => {
  const calls = []
  const credential = installWebAuthnBrowser(calls)
  const supabase = fakeSupabase({ credentialType: "create", calls })

  const result = await registerAdminWebAuthnFactor(supabase)

  assert.deepEqual(result, { ok: true })
  assert.equal(
    calls.find(({ operation }) => operation === "create").publicKey
      .authenticatorSelection.userVerification,
    "required"
  )
  assert.equal(
    calls.find(({ operation }) => operation === "verify").params.webauthn
      .credential_response,
    credential
  )
})

test("a failed registration removes the unverified factor", async () => {
  const calls = []
  installWebAuthnBrowser(calls)
  const supabase = fakeSupabase({
    credentialType: "create",
    calls,
    verifyError: new Error("rejected"),
  })

  const result = await registerAdminWebAuthnFactor(supabase)

  assert.equal(result.ok, false)
  assert.deepEqual(
    calls.find(({ operation }) => operation === "unenroll").params,
    { factorId: "factor-1" }
  )
})

test("step-up requires exactly one WebAuthn factor and user verification", async () => {
  const calls = []
  installWebAuthnBrowser(calls)
  const supabase = fakeSupabase({ credentialType: "request", calls })

  assert.deepEqual(await stepUpAdminWebAuthn(supabase), { ok: true })
  assert.equal(
    calls.find(({ operation }) => operation === "get").publicKey
      .userVerification,
    "required"
  )

  const noFactor = fakeSupabase({
    credentialType: "request",
    calls: [],
    factors: [],
  })
  assert.equal((await stepUpAdminWebAuthn(noFactor)).ok, false)
})

function installWebAuthnBrowser(calls) {
  class FakePublicKeyCredential {}
  const credential = new FakePublicKeyCredential()

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { origin: "https://nabaperks.com" },
      PublicKeyCredential: FakePublicKeyCredential,
    },
  })
  Object.defineProperty(globalThis, "PublicKeyCredential", {
    configurable: true,
    value: FakePublicKeyCredential,
  })
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      credentials: {
        async create({ publicKey }) {
          calls.push({ operation: "create", publicKey })
          return credential
        },
        async get({ publicKey }) {
          calls.push({ operation: "get", publicKey })
          return credential
        },
      },
    },
  })
  return credential
}

function fakeSupabase({
  credentialType,
  calls,
  factors = [{ id: "factor-1" }],
  verifyError = null,
}) {
  return {
    auth: {
      mfa: {
        async enroll(params) {
          calls.push({ operation: "enroll", params })
          return { data: { id: "factor-1" }, error: null }
        },
        async challenge(params) {
          calls.push({ operation: "challenge", params })
          return {
            data: {
              id: "challenge-1",
              webauthn: {
                type: credentialType,
                credential_options: {
                  publicKey:
                    credentialType === "create"
                      ? { authenticatorSelection: {} }
                      : {},
                },
              },
            },
            error: null,
          }
        },
        async verify(params) {
          calls.push({ operation: "verify", params })
          return { data: verifyError ? null : {}, error: verifyError }
        },
        async unenroll(params) {
          calls.push({ operation: "unenroll", params })
          return { data: {}, error: null }
        },
        async listFactors() {
          return {
            data: { webauthn: factors },
            error: null,
          }
        },
      },
    },
  }
}

function restoreGlobal(name, value) {
  if (value === undefined) {
    delete globalThis[name]
    return
  }
  Object.defineProperty(globalThis, name, { configurable: true, value })
}
