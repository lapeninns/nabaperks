import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, test } from "node:test"
import { build } from "esbuild"

/**
 * The join terms step (`joinRewardsAction`) with a claim handoff waiting.
 *
 * QA BUG-044 (38c42a1..2c45031): a wallet whose phone number is stored but
 * not verified (phone_last4 set, phone_verified_at null) opened a live offer
 * and joined. The claim RPC refuses such a wallet as 'invalid' (the answer
 * for a stale link), and the action decided "has a phone" from phoneLast4,
 * so it skipped the "needs a confirmed phone" guard and the offer was lost
 * without a word.
 *
 * QA BUG-048: an invitation refused because ANOTHER wallet holds the invited
 * email told the wallet (which may have no email at all) that it "uses" a
 * different email.
 *
 * The real action module is bundled; the Supabase service client, cookies and
 * identity lookups are stand-ins answering as the database does.
 */
const REAL = new Set([
  "@/lib/customer/email-auth-mode",
  "@/lib/customer/join-observability-contract",
  "@/lib/offers/claim-handoff",
  "@/lib/navigation/customer-join-intent",
  "@/lib/observability/request-id",
])

const SUPABASE = `import { state } from "fixture-state";
  export function createSupabaseServiceRoleClient() {
    return {
      async rpc(name, args) {
        state.rpcCalls.push(name)
        const answer = state.rpc[name]
        return typeof answer === "function" ? answer(args) : answer ?? { data: null, error: { message: "unexpected rpc " + name } }
      },
      from(table) {
        const query = {
          select() { return query },
          eq() { return query },
          async maybeSingle() { return { data: state.rows[table] ?? null, error: null } },
        }
        return query
      },
    }
  }`

const SPECIAL = {
  "server-only": "",
  "next/navigation": `export function redirect(destination) {
    const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error
  }`,
  "next/headers": `export async function headers() { return new Headers() }
    export async function cookies() { return { get() {}, set() {}, delete() {} } }`,
  "next/server": "export function after() {}",
  "@/lib/supabase/server": SUPABASE,
  "@/lib/legal/content": 'export const CUSTOMER_LEGAL_VERSION = "test"',
  "@/lib/observability/logger":
    "export const logger = { error() {}, warn() {}, info() {} }",
}

const IMPORT_PATTERN = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/g

function importedNames(file) {
  const names = new Map()
  const source = readFileSync(file, "utf8")
  for (const [, list, specifier] of source.matchAll(IMPORT_PATTERN)) {
    const set = names.get(specifier) ?? new Set()
    for (const raw of list.split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0]
      if (name && !name.startsWith("type ")) set.add(name)
    }
    names.set(specifier, set)
  }
  return names
}

function stubModule(specifier, names) {
  if (specifier in SPECIAL) return SPECIAL[specifier]
  const exports = [...names].map(
    (name) => `export async function ${name}(...args) {
      state.calls.push(${JSON.stringify(name)});
      const impl = state.impl[${JSON.stringify(name)}];
      return typeof impl === "function" ? impl(...args) : impl
    }`
  )
  return `import { state } from "fixture-state";\n${exports.join("\n")}`
}

const STATE = `export const state = {
  impl: {}, calls: [], rpc: {}, rpcCalls: [], rows: {},
};`

async function loadJoinActions() {
  const root = process.cwd()
  const file = path.join(
    root,
    "app",
    "m",
    "[merchantSlug]",
    "join",
    "actions.ts"
  )
  const names = importedNames(file)
  const result = await build({
    stdin: {
      contents: `export { joinRewardsAction } from "./app/m/[merchantSlug]/join/actions.ts";
        export { state } from "fixture-state";`,
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "join-claim-boundaries",
        setup(build) {
          build.onResolve({ filter: /^@\/lib\// }, ({ path: specifier }) =>
            REAL.has(specifier)
              ? { path: path.join(root, `${specifier.slice(2)}.ts`) }
              : { path: specifier, namespace: "fixture" }
          )
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/)/ },
            ({ path: specifier }) => ({ path: specifier, namespace: "fixture" })
          )
          build.onLoad(
            { filter: /.*/, namespace: "fixture" },
            ({ path: id }) => ({
              contents:
                id === "fixture-state"
                  ? STATE
                  : stubModule(id, names.get(id) ?? new Set()),
              resolveDir: root,
            })
          )
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${randomUUID()}`
  )
}

function termsForm() {
  const data = new FormData()
  data.set("merchantSlug", "old-crown")
  data.set("loyaltyTerms", "on")
  return data
}

/** The action's answer: its returned state, or where it redirected. */
async function submit(actions) {
  try {
    return { state: await actions.joinRewardsAction({}, termsForm()) }
  } catch (error) {
    if (error?.message === "NEXT_REDIRECT") {
      return { redirect: error.destination }
    }
    throw error
  }
}

const HANDOFF = {
  merchantSlug: "old-crown",
  claimTokenHash: "c".repeat(64),
  expiresAt: 2_000_000_000,
}

afterEach(() => {
  delete process.env.CUSTOMER_EMAIL_AUTH_MODE
})

function offerStubs(state, { phoneVerified }) {
  Object.assign(state.impl, {
    // phone_last4 is stored whether or not the number was ever confirmed.
    getCurrentCustomer: { id: "customer-1", phoneLast4: "0123" },
    readInviteCookie: null,
    readOfferCookie: HANDOFF,
    isOfferClaimAvailable: true,
    customerHasVerifiedPhone: phoneVerified,
  })
  // The claim RPC requires phone_hmac AND phone_verified_at; an unverified
  // phone gets the same 'invalid' answer as a stale link.
  state.rpc.claim_offer_campaign = {
    data: [
      phoneVerified
        ? { status: "claimed", membership_id: "membership-1" }
        : { status: "invalid" },
    ],
    error: null,
  }
  state.rpc.join_customer_membership_with_first_stamp = {
    data: [{ membership_id: "membership-plain", merchant_id: "m-1" }],
    error: null,
  }
}

test("Given a wallet whose phone is stored but not confirmed When it joins with a live offer Then it is told the offer needs a confirmed phone", async () => {
  const actions = await loadJoinActions()
  offerStubs(actions.state, { phoneVerified: false })

  const answer = await submit(actions)

  assert.equal(answer.redirect, undefined, "no silent plain join")
  assert.match(answer.state.errors.form, /needs a confirmed phone number/)
  assert.equal(
    actions.state.rpcCalls.includes(
      "join_customer_membership_with_first_stamp"
    ),
    false
  )
  assert.ok(actions.state.calls.includes("clearOfferCookie"))
})

test("Given a wallet with a confirmed phone When it joins with a live offer Then the offer is claimed", async () => {
  const actions = await loadJoinActions()
  offerStubs(actions.state, { phoneVerified: true })

  const answer = await submit(actions)

  assert.equal(answer.redirect, "/card/membership-1?welcome=1&offer=1")
  assert.equal(
    actions.state.calls.includes("isOfferClaimAvailable"),
    false,
    "a confirmed phone goes straight to the claim"
  )
})

test("Given the phone check cannot be read When the wallet joins with an offer Then the handoff is kept for a retry", async () => {
  const actions = await loadJoinActions()
  offerStubs(actions.state, { phoneVerified: false })
  actions.state.impl.customerHasVerifiedPhone = () => {
    throw new Error("database unavailable")
  }

  const answer = await submit(actions)

  assert.match(answer.state.errors.form, /couldn't add this offer/i)
  assert.equal(actions.state.calls.includes("clearOfferCookie"), false)
  assert.deepEqual(actions.state.rpcCalls, [])
})

function inviteStubs(state, conflictReason) {
  Object.assign(state.impl, {
    getCurrentCustomer: { id: "customer-1", phoneLast4: "0123" },
    readInviteCookie: HANDOFF,
    readOfferCookie: null,
    decryptCustomerEmail: "invited@example.com",
    customerEmailHmac: "e".repeat(64),
  })
  state.rows.loyalty_invite_recipients = { email_ciphertext: "v1.a.b.c" }
  state.rpc.claim_loyalty_invite = {
    data: [
      {
        status: "email_conflict",
        membership_id: null,
        stamps_awarded: 0,
        ...(conflictReason === undefined
          ? {}
          : { conflict_reason: conflictReason }),
      },
    ],
    error: null,
  }
}

const OWN_EMAIL_DIFFERS =
  "This invitation was sent to a different email than your account uses, so no welcome stamps were added."

// Neutral on purpose (BUG-048 refinement): whoever holds the invitation link
// must not learn from the copy that the invited address has a wallet.
const NOT_NEUTRAL =
  /another Nabaperks wallet|belongs to|already (used|registered|has)/i

test("Given another wallet holds the invited email When a wallet joins from the invitation Then it is told neutrally to sign in with the invited email", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const actions = await loadJoinActions()
  inviteStubs(actions.state, "email_held_elsewhere")

  const { state } = await submit(actions)

  assert.equal(
    state.errors.form,
    "This invitation is for a different email, so no welcome stamps were added. Sign in with the email it was sent to, or ask the venue for a new invitation."
  )
  assert.notEqual(state.errors.form, OWN_EMAIL_DIFFERS)
  assert.doesNotMatch(state.errors.form, /your account uses/i)
  assert.doesNotMatch(state.errors.form, NOT_NEUTRAL)
  assert.doesNotMatch(state.errors.form, /!/)
})

test("Given email sign-in is off When another wallet holds the invited email Then the copy does not offer an email sign-in", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "off"
  const actions = await loadJoinActions()
  inviteStubs(actions.state, "email_held_elsewhere")

  const { state } = await submit(actions)

  assert.equal(
    state.errors.form,
    "This invitation is for a different email, so no welcome stamps were added. Ask the venue for a new invitation."
  )
  assert.doesNotMatch(state.errors.form, NOT_NEUTRAL)
  assert.doesNotMatch(state.errors.form, /sign in/i)
})

test("Given the wallet's own verified email differs When it joins from the invitation Then it keeps the own-email copy", async () => {
  for (const reason of ["wallet_email_differs", undefined]) {
    const actions = await loadJoinActions()
    inviteStubs(actions.state, reason)

    const { state } = await submit(actions)

    assert.equal(state.errors.form, OWN_EMAIL_DIFFERS)
  }
})
