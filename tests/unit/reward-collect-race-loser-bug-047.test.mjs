import assert from "node:assert/strict"
import { test } from "node:test"

import { build } from "esbuild"

// QA BUG-047 (38c42a1..2c45031): when two staff devices collect the same
// reward, the losing device showed "This reward has already been collected."
// under a still-green "Ready to collect" ticket with an enabled collect
// button. A refusal that means the reward is closed must refresh the scan
// page so the server's redeemed state replaces the stale ready form.
//
// The real action, collection helpers and ID-check helper run; only Next,
// the cache tags, the merchant session and the Supabase client are stubbed.
async function loadAction() {
  const result = await build({
    stdin: {
      contents: `export { confirmMerchantRewardCollectionAction } from "./app/app/rewards/scan/[scanToken]/actions.ts"; export { state } from "fixture-state";`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
    plugins: [
      {
        name: "collect-action-boundaries",
        setup(build) {
          build.onResolve(
            {
              filter:
                /^(fixture-state|server-only|next\/cache|next\/navigation|@\/lib\/cache\/tags|@\/lib\/supabase\/server|@\/lib\/auth\/session)$/,
            },
            ({ path }) => ({ path, namespace: "fixture" })
          )
          build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
            contents: {
              "fixture-state": `export const state = { merchant: { id: "merchant-1" }, responses: {}, revalidated: [] };`,
              "server-only": "",
              "next/cache": `import {state} from "fixture-state"; export function revalidatePath(path) { state.revalidated.push(path) }`,
              "next/navigation": `export function redirect(destination) { const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error }`,
              "@/lib/cache/tags": `export function merchantActivitySummaryCacheTag(id) { return "summary:" + id } export function revalidateCacheTag() {}`,
              "@/lib/auth/session": `import {state} from "fixture-state"; export async function getCurrentMerchant() { return state.merchant } export async function getCurrentUser() { return state.merchant ? { id: "owner-1" } : null }`,
              "@/lib/supabase/server": `import {state} from "fixture-state";
function client() { return { async rpc(name) { return state.responses[name] ?? { data: null, error: { message: "unexpected rpc " + name } } } } }
export async function createSupabaseServerClient() { return client() }
export function createSupabaseServiceRoleClient() { return client() }`,
            }[path],
          }))
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
}

const SCAN_TOKEN = "11111111-1111-4111-8111-111111111111"
const SCAN_PATH = `/app/rewards/scan/${SCAN_TOKEN}`

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries({
    scanToken: SCAN_TOKEN,
    ...fields,
  }))
    data.set(key, value)
  return data
}

async function submit(mod, fields = {}) {
  try {
    return {
      state: await mod.confirmMerchantRewardCollectionAction({}, form(fields)),
    }
  } catch (error) {
    if (error?.destination) return { redirect: error.destination }
    throw error
  }
}

for (const message of [
  "Reward scan token already used",
  "Reward already redeemed",
  "Reward already collected",
]) {
  test(`Given the other device collected first (${message}) When this device presses collect Then the scan page is refreshed with the error`, async () => {
    const mod = await loadAction()
    mod.state.responses.collect_owner_reward_scan_token = {
      data: null,
      error: { message },
    }

    const outcome = await submit(mod)

    assert.deepEqual(outcome, {
      state: { errors: { form: "This reward has already been collected." } },
    })
    assert.deepEqual(mod.state.revalidated, [SCAN_PATH])
  })
}

test("Given the ID-check form loses the race When it is refused Then the scan page is refreshed", async () => {
  const mod = await loadAction()
  mod.state.responses.verify_and_collect_reward_scan_token = {
    data: null,
    error: { message: "Reward already redeemed" },
  }

  const outcome = await submit(mod, {
    collectionMode: "verify_id",
    expectedDateOfBirth: "1991-02-03",
    idConfirmed: "true",
  })

  assert.equal(
    outcome.state?.errors?.form,
    "This reward has already been collected."
  )
  assert.deepEqual(mod.state.revalidated, [SCAN_PATH])
})

test("Given a refusal that leaves the reward open When staff press collect Then the form keeps its error without a refresh", async () => {
  const mod = await loadAction()
  mod.state.responses.verify_and_collect_reward_scan_token = {
    data: null,
    error: { message: "Reward date of birth changed" },
  }

  const outcome = await submit(mod, {
    collectionMode: "verify_id",
    expectedDateOfBirth: "1991-02-03",
    idConfirmed: "true",
  })

  assert.equal(
    outcome.state?.errors?.form,
    "The customer's date of birth changed. Refresh and check their ID again."
  )
  assert.deepEqual(mod.state.revalidated, [])
})

test("Given the winning device When collection succeeds Then it still redirects to the collected page", async () => {
  const mod = await loadAction()
  mod.state.responses.collect_owner_reward_scan_token = {
    data: [
      {
        reward_event_id: "reward-1",
        reward_name: "Free coffee",
        membership_id: "membership-1",
      },
    ],
    error: null,
  }

  const outcome = await submit(mod)

  assert.deepEqual(outcome, { redirect: `${SCAN_PATH}?collected=1` })
  assert.ok(mod.state.revalidated.includes(SCAN_PATH))
})
