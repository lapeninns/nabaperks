import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { build } from "esbuild"

async function load() {
  const modules = {
    fixture: `export const state={session:{customerId:'source',sessionId:'session'},data:[],error:null,cookies:[],calls:[]}`,
    "server-only": "",
    "@/lib/customer/email-pii-core":
      "export const customerEmailHmac=()=> 'email-hmac'",
    "@/lib/customer/phone-pii":
      "export const customerPhoneHmac=()=> 'phone-hmac'",
    "@/lib/customer/session": `import {state} from 'fixture';export const getCustomerSession=async()=>state.session;export const setCustomerSession=async(...args)=>state.cookies.push(args)`,
    "@/lib/supabase/server": `import {state} from 'fixture';export const createSupabaseServiceRoleClient=()=>({rpc:async(...args)=>{state.calls.push(args);return {data:state.data,error:state.error}}})`,
  }
  const result = await build({
    stdin: {
      contents:
        "export * from './lib/customer/wallet-link.ts';export {state} from 'fixture'",
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "boundaries",
        setup(b) {
          b.onResolve({ filter: /^(fixture|server-only|@\/)/ }, ({ path }) => ({
            path,
            namespace: "stub",
          }))
          b.onLoad({ filter: /.*/, namespace: "stub" }, ({ path }) => {
            assert.ok(path in modules)
            return { contents: modules[path] }
          })
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${randomUUID()}`
  )
}

for (const method of ["email", "phone"]) {
  test(`Given two verified contacts When ${method} linking succeeds Then a fresh canonical session is issued`, async () => {
    const { state, linkWalletAfterContactVerification } = await load()
    const id = randomUUID()
    state.data = [{ status: "linked", customer_id: id }]
    const result = await linkWalletAfterContactVerification(method, "contact")
    assert.deepEqual(result, { status: "linked", customerId: id })
    assert.deepEqual(state.cookies, [[id, `verified_${method}`]])
    assert.deepEqual(state.calls[0], [
      "link_verified_customer_wallets",
      {
        p_customer_id: "source",
        p_session_id: "session",
        p_method: method,
        p_contact_hmac: `${method}-hmac`,
      },
    ])
  })
}

test("Given no live session When linking is requested Then neither RPC nor session issuance happens", async () => {
  const { state, linkWalletAfterContactVerification } = await load()
  state.session = null
  assert.deepEqual(
    await linkWalletAfterContactVerification("email", "contact"),
    { status: "reauthenticate" }
  )
  assert.deepEqual(state.calls, [])
  assert.deepEqual(state.cookies, [])
})

for (const data of [
  null,
  [],
  [{}],
  [{ status: "linked", customer_id: "invalid" }],
  [{ status: "requires_review", customer_id: randomUUID() }],
]) {
  test("Given an invalid RPC response When linking completes Then no canonical session is issued", async () => {
    const { state, linkWalletAfterContactVerification, WalletLinkError } =
      await load()
    state.data = data
    await assert.rejects(
      () => linkWalletAfterContactVerification("email", "contact"),
      WalletLinkError
    )
    assert.deepEqual(state.cookies, [])
  })
}

test("Given a database failure When linking is attempted Then no session is issued", async () => {
  const { state, linkWalletAfterContactVerification, WalletLinkError } =
    await load()
  state.error = { message: "unavailable" }
  await assert.rejects(
    () => linkWalletAfterContactVerification("phone", "contact"),
    WalletLinkError
  )
  assert.deepEqual(state.cookies, [])
})
