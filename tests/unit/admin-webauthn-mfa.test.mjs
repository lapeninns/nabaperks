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

test("registration requires local user verification and sends the response to the server verifier", async () => {
  const calls = []
  installWebAuthnBrowser(calls, "registration")
  const supabase = fakeSupabase(calls)

  assert.deepEqual(await registerAdminWebAuthnFactor(supabase), { ok: true })
  assert.equal(
    calls.find(({ operation }) => operation === "create").publicKey
      .authenticatorSelection.userVerification,
    "required"
  )
  assert.deepEqual(
    calls
      .filter(({ operation }) => operation === "invoke")
      .map(({ body }) => body.action),
    ["registration-options", "registration-verify"]
  )
})

test("a rejected registration remains fail-closed", async () => {
  const calls = []
  installWebAuthnBrowser(calls, "registration")
  const supabase = fakeSupabase(calls, "registration-verify")

  const result = await registerAdminWebAuthnFactor(supabase)

  assert.equal(result.ok, false)
  assert.equal(
    calls.filter(({ operation }) => operation === "invoke").length,
    2
  )
})

test("step-up requires user verification and an accepted session grant", async () => {
  const calls = []
  installWebAuthnBrowser(calls, "authentication")
  const supabase = fakeSupabase(calls)

  assert.deepEqual(await stepUpAdminWebAuthn(supabase), { ok: true })
  assert.equal(
    calls.find(({ operation }) => operation === "get").publicKey
      .userVerification,
    "required"
  )
  assert.deepEqual(
    calls
      .filter(({ operation }) => operation === "invoke")
      .map(({ body }) => body.action),
    ["authentication-options", "authentication-verify"]
  )
})

test("an alternate-origin ceremony is rejected before a credential request", async () => {
  const calls = []
  installWebAuthnBrowser(calls, "authentication", "https://example.net")

  await assert.rejects(() => stepUpAdminWebAuthn(fakeSupabase(calls)))
  assert.equal(calls.length, 0)
})

function installWebAuthnBrowser(calls, kind, origin = "https://nabaperks.com") {
  class FakePublicKeyCredential {}
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { origin },
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
          return fakeCredential("registration")
        },
        async get({ publicKey }) {
          calls.push({ operation: "get", publicKey })
          return fakeCredential("authentication")
        },
      },
    },
  })
  assert.ok(["registration", "authentication"].includes(kind))
}

function fakeCredential(kind) {
  const shared = {
    id: "credential-id",
    rawId: new Uint8Array([1, 2, 3]).buffer,
    type: "public-key",
    authenticatorAttachment: "platform",
    getClientExtensionResults: () => ({}),
  }
  if (kind === "registration") {
    return {
      ...shared,
      response: {
        attestationObject: new Uint8Array([1]).buffer,
        clientDataJSON: new Uint8Array([2]).buffer,
        getTransports: () => ["internal"],
      },
    }
  }
  return {
    ...shared,
    response: {
      authenticatorData: new Uint8Array([1]).buffer,
      clientDataJSON: new Uint8Array([2]).buffer,
      signature: new Uint8Array([3]).buffer,
      userHandle: null,
    },
  }
}

function fakeSupabase(calls, rejectedAction = null) {
  return {
    functions: {
      async invoke(_name, { body }) {
        calls.push({ operation: "invoke", body })
        if (body.action === rejectedAction) {
          return { data: null, error: new Error("rejected") }
        }
        if (body.action.endsWith("-verify")) {
          return { data: { ok: true }, error: null }
        }
        return {
          data: {
            ok: true,
            challengeId: "11111111-1111-4111-8111-111111111111",
            options:
              body.action === "registration-options"
                ? registrationOptions()
                : authenticationOptions(),
          },
          error: null,
        }
      },
    },
  }
}

function registrationOptions() {
  return {
    challenge: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    rp: { id: "nabaperks.com", name: "Nabaperks" },
    user: {
      id: "AQID",
      name: "admin@example.com",
      displayName: "Administrator",
    },
    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
    authenticatorSelection: { userVerification: "required" },
  }
}

function authenticationOptions() {
  return {
    challenge: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    rpId: "nabaperks.com",
    userVerification: "required",
    allowCredentials: [{ id: "AQID", type: "public-key" }],
  }
}

function restoreGlobal(name, value) {
  if (value === undefined) {
    delete globalThis[name]
    return
  }
  Object.defineProperty(globalThis, name, { configurable: true, value })
}
