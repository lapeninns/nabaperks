import assert from "node:assert/strict"
import { test } from "node:test"

import { build } from "esbuild"

// QA BUG-008 (38c42a1..2c45031): once the database requires a verified phone,
// a reward held by a wallet without one is "blocked" with the customer-facing
// reason "Complete your profile before redeeming". Staff must see what to ask
// the customer, on the scan page and when pressing collect, not a crash or
// copy addressed to the customer.
async function loadCollection() {
  const result = await build({
    stdin: {
      contents: `export { collectMerchantScannedReward, loadMerchantRewardScanContext } from "./lib/merchant/reward-collection.ts"; export { state } from "fixture-state";`,
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
                  ? `export const state = { merchant: { id: "merchant-1" }, responses: {} };`
                  : path.endsWith("session")
                    ? `import {state} from "fixture-state"; export async function getCurrentMerchant() { return state.merchant; } export async function getCurrentUser() { return state.merchant ? { id: "owner-1" } : null; }`
                    : `import {state} from "fixture-state";
function client() {
  return { async rpc(name) { return state.responses[name]; } };
}
export async function createSupabaseServerClient() { return client(); }
export function createSupabaseServiceRoleClient() { return client(); }`,
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
const STAFF_COPY =
  "Ask the customer to finish their profile before this reward can be collected."

test("Given a phone-blocked reward When staff open its scan Then the page explains what to ask the customer", async () => {
  const mod = await loadCollection()
  mod.state.responses.get_owner_reward_scan_context = {
    data: [
      {
        scan_status: "blocked",
        blocked_reason: "Complete your profile before redeeming",
        reward_event_id: "reward-1",
        reward_name: "Free coffee",
        membership_id: "membership-1",
        customer_email: "c***@example.test",
      },
    ],
    error: null,
  }

  const context = await mod.loadMerchantRewardScanContext(SCAN_TOKEN)

  assert.equal(context.status, "blocked")
  assert.equal(context.blockedReason, STAFF_COPY)
})

test("Given another blocked reason When staff open the scan Then the database reason is kept", async () => {
  const mod = await loadCollection()
  mod.state.responses.get_owner_reward_scan_context = {
    data: [
      {
        scan_status: "blocked",
        blocked_reason: "One reward per visit day already collected",
        reward_event_id: "reward-1",
        reward_name: "Free coffee",
        membership_id: "membership-1",
      },
    ],
    error: null,
  }

  const context = await mod.loadMerchantRewardScanContext(SCAN_TOKEN)

  assert.equal(
    context.blockedReason,
    "One reward per visit day already collected"
  )
})

test("Given the database refuses collection for a missing phone When staff press collect Then they get the same guidance", async () => {
  const mod = await loadCollection()
  mod.state.responses.collect_owner_reward_scan_token = {
    data: null,
    error: {
      code: "23514",
      message: "Complete your profile before redeeming",
    },
  }

  const result = await mod.collectMerchantScannedReward(SCAN_TOKEN)

  assert.deepEqual(result, { status: "blocked", reason: STAFF_COPY })
})
