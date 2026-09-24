import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * collectMerchantScannedReward — the plain counter "Collect" path.
 *
 * Runs the real module; only the merchant session and the two Supabase client
 * factories are substituted. Every RPC is recorded with the client that made
 * it, so the tests prove the owner session (not the service role) performs
 * the collection and that the legacy fallback only covers a missing RPC.
 */
async function loadCollection() {
  const result = await build({
    stdin: {
      contents: `export { collectMerchantScannedReward } from "./lib/merchant/reward-collection.ts"; export { state } from "fixture-state";`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "collection-boundaries",
        setup(build) {
          build.onResolve(
            {
              filter:
                /^(fixture-state|server-only|@\/lib\/supabase\/server|@\/lib\/auth\/session)$/,
            },
            ({ path }) => ({ path, namespace: "fixture" })
          )
          build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
            contents:
              path === "server-only"
                ? ""
                : path === "fixture-state"
                  ? `export const state = { merchant: null, responses: {}, calls: [] };`
                  : path.endsWith("session")
                    ? `import {state} from "fixture-state"; export async function getCurrentMerchant() { return state.merchant; }`
                    : `import {state} from "fixture-state";
function client(kind) {
  return {
    async rpc(name, args) {
      state.calls.push({ kind, name, args });
      return state.responses[name] ?? { data: null, error: { message: "unexpected rpc " + name } };
    },
  };
}
export async function createSupabaseServerClient() { return client("owner"); }
export function createSupabaseServiceRoleClient() { return client("service"); }`,
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
const COLLECTED_ROW = {
  reward_event_id: "reward-1",
  reward_name: "Free coffee",
  membership_id: "membership-1",
  new_stamp_count: 0,
}

function seed(mod, responses) {
  Object.assign(mod.state, {
    merchant: { id: "merchant-1" },
    responses,
    calls: [],
  })
}

test("the owner session collects without supplying a merchant ID", async () => {
  const mod = await loadCollection()
  seed(mod, {
    collect_owner_reward_scan_token: { data: [COLLECTED_ROW], error: null },
  })

  const result = await mod.collectMerchantScannedReward(SCAN_TOKEN)

  assert.deepEqual(result, {
    status: "collected",
    scanToken: SCAN_TOKEN,
    rewardId: "reward-1",
    merchantId: "merchant-1",
    rewardName: "Free coffee",
    membershipId: "membership-1",
  })
  assert.deepEqual(mod.state.calls, [
    {
      kind: "owner",
      name: "collect_owner_reward_scan_token",
      args: { p_scan_token: SCAN_TOKEN },
    },
  ])
})

test("a database refusal is shown as merchant copy and never retried as the service role", async () => {
  const mod = await loadCollection()
  seed(mod, {
    collect_owner_reward_scan_token: {
      data: null,
      error: {
        code: "42501",
        message: "Reward not available to this merchant",
      },
    },
  })

  const result = await mod.collectMerchantScannedReward(SCAN_TOKEN)

  assert.deepEqual(result, {
    status: "blocked",
    reason: "This reward is not available to your merchant account.",
  })
  assert.equal(
    mod.state.calls.some((call) => call.kind === "service"),
    false
  )
})

test("before the migration lands, a missing owner RPC falls back to the legacy collector", async () => {
  const mod = await loadCollection()
  seed(mod, {
    collect_owner_reward_scan_token: {
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.collect_owner_reward_scan_token",
      },
    },
    collect_current_reward_scan_token: { data: [COLLECTED_ROW], error: null },
  })

  const result = await mod.collectMerchantScannedReward(SCAN_TOKEN)

  assert.equal(result.status, "collected")
  assert.deepEqual(
    mod.state.calls.map(({ kind, name, args }) => ({ kind, name, args })),
    [
      {
        kind: "owner",
        name: "collect_owner_reward_scan_token",
        args: { p_scan_token: SCAN_TOKEN },
      },
      {
        kind: "service",
        name: "collect_current_reward_scan_token",
        args: { p_scan_token: SCAN_TOKEN, p_merchant_id: "merchant-1" },
      },
    ]
  )
})

test("a signed-out caller makes no collection call", async () => {
  const mod = await loadCollection()
  seed(mod, {})
  mod.state.merchant = null

  const result = await mod.collectMerchantScannedReward(SCAN_TOKEN)

  assert.equal(result.status, "blocked")
  assert.deepEqual(mod.state.calls, [])
})
